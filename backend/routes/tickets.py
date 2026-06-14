from flask import Blueprint, request, jsonify
from datetime import datetime
from models import get_db, create_operation_log
from auth import require_permission, get_current_user, has_permission

tickets_bp = Blueprint('tickets', __name__)


def _ticket_to_dict(row):
    return {
        'id': row['id'],
        'title': row['title'],
        'description': row['description'],
        'status_id': row['status_id'],
        'status_name': row['status_name'],
        'status_color': row['status_color'],
        'priority': row['priority'],
        'creator_id': row['creator_id'],
        'creator_name': row['creator_name'],
        'assignee_id': row['assignee_id'],
        'assignee_name': row['assignee_name'],
        'created_at': row['created_at'],
        'updated_at': row['updated_at'],
    }


def _record_history(db, ticket_id, field, old_value, new_value, user_id):
    db.execute('''INSERT INTO ticket_history (ticket_id, field, old_value, new_value, changed_by)
                  VALUES (?, ?, ?, ?, ?)''',
               (ticket_id, field, old_value, new_value, user_id))


def _can_transition(db, from_status_id, to_status_id):
    if from_status_id == to_status_id:
        return True
    if from_status_id is None:
        return True
    row = db.execute('''SELECT 1 FROM status_transitions
                         WHERE from_status_id = ? AND to_status_id = ?''',
                     (from_status_id, to_status_id)).fetchone()
    return row is not None


@tickets_bp.route('', methods=['GET'])
@require_permission('ticket:read')
def list_tickets():
    user = get_current_user()
    db = get_db()
    status_id = request.args.get('status_id', type=int)
    keyword = request.args.get('keyword', '').strip()
    priority = request.args.get('priority', '').strip()
    assignee_id = request.args.get('assignee_id', type=int)

    sql = '''SELECT t.*, s.name as status_name, s.color as status_color,
                    c.username as creator_name, a.username as assignee_name
             FROM tickets t
             LEFT JOIN statuses s ON t.status_id = s.id
             LEFT JOIN users c ON t.creator_id = c.id
             LEFT JOIN users a ON t.assignee_id = a.id
             WHERE 1=1'''
    params = []

    # Non-admin users only see tickets they created or are assigned to
    if user['role_name'] not in ('super_admin', 'admin'):
        sql += ' AND (t.creator_id = ? OR t.assignee_id = ?)'
        params.extend([user['id'], user['id']])

    if status_id:
        sql += ' AND t.status_id = ?'
        params.append(status_id)
    if priority:
        sql += ' AND t.priority = ?'
        params.append(priority)
    if assignee_id:
        sql += ' AND t.assignee_id = ?'
        params.append(assignee_id)
    if keyword:
        sql += ' AND (t.title LIKE ? OR t.description LIKE ?)'
        params.extend([f'%{keyword}%', f'%{keyword}%'])

    sql += ' ORDER BY t.updated_at DESC'
    rows = db.execute(sql, params).fetchall()
    return jsonify([_ticket_to_dict(r) for r in rows]), 200


@tickets_bp.route('/<int:id>', methods=['GET'])
@require_permission('ticket:read')
def get_ticket(id):
    db = get_db()
    row = db.execute('''SELECT t.*, s.name as status_name, s.color as status_color,
                               c.username as creator_name, a.username as assignee_name
                        FROM tickets t
                        LEFT JOIN statuses s ON t.status_id = s.id
                        LEFT JOIN users c ON t.creator_id = c.id
                        LEFT JOIN users a ON t.assignee_id = a.id
                        WHERE t.id = ?''', (id,)).fetchone()
    if not row:
        return jsonify({'error': '工单不存在'}), 404
    user = get_current_user()
    if user['role_name'] not in ('super_admin', 'admin'):
        if row['creator_id'] != user['id'] and row['assignee_id'] != user['id']:
            return jsonify({'error': '没有权限查看此工单'}), 403
    return jsonify(_ticket_to_dict(row)), 200


@tickets_bp.route('', methods=['POST'])
@require_permission('ticket:create')
def create_ticket():
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    priority = data.get('priority', 'medium').strip()
    assignee_id = data.get('assignee_id')
    status_id = data.get('status_id')

    if not title:
        return jsonify({'error': '工单标题不能为空'}), 400

    user = get_current_user()
    db = get_db()

    if status_id is None:
        default = db.execute('SELECT id FROM statuses WHERE is_default = 1 LIMIT 1').fetchone()
        status_id = default['id'] if default else None

    cur = db.execute('''INSERT INTO tickets (title, description, status_id, priority, creator_id, assignee_id)
                        VALUES (?, ?, ?, ?, ?, ?)''',
                     (title, description, status_id, priority, user['id'], assignee_id))
    db.commit()

    create_operation_log(
        db,
        user_id=user['id'],
        username=user['username'],
        action='ticket_create',
        target_type='ticket',
        target_id=cur.lastrowid,
        detail=f"创建工单：{title}"
    )

    return get_ticket(cur.lastrowid)


@tickets_bp.route('/<int:id>', methods=['PUT'])
@require_permission('ticket:update')
def update_ticket(id):
    data = request.get_json() or {}
    db = get_db()
    ticket = db.execute('SELECT * FROM tickets WHERE id = ?', (id,)).fetchone()
    if not ticket:
        return jsonify({'error': '工单不存在'}), 404

    user = get_current_user()
    is_admin = user['role_name'] in ('super_admin', 'admin')
    if not is_admin and ticket['creator_id'] != user['id'] and ticket['assignee_id'] != user['id']:
        return jsonify({'error': '没有权限修改此工单'}), 403

    title = data.get('title', ticket['title']).strip()
    description = data.get('description', ticket['description'])
    priority = data.get('priority', ticket['priority']).strip()
    assignee_id = data.get('assignee_id', ticket['assignee_id'])
    status_id = data.get('status_id', ticket['status_id'])

    if not title:
        return jsonify({'error': '工单标题不能为空'}), 400

    # Validate status transition
    if status_id != ticket['status_id']:
        if not _can_transition(db, ticket['status_id'], status_id):
            return jsonify({'error': '当前状态不允许流转到目标状态'}), 400
        old_status = db.execute('SELECT name FROM statuses WHERE id = ?', (ticket['status_id'],)).fetchone()
        new_status = db.execute('SELECT name FROM statuses WHERE id = ?', (status_id,)).fetchone()
        _record_history(db, id, 'status',
                        old_status['name'] if old_status else '',
                        new_status['name'] if new_status else '',
                        user['id'])

    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    db.execute('''UPDATE tickets SET title = ?, description = ?, priority = ?,
                                     assignee_id = ?, status_id = ?, updated_at = ?
                  WHERE id = ?''',
               (title, description, priority, assignee_id, status_id, now, id))
    db.commit()

    create_operation_log(
        db,
        user_id=user['id'],
        username=user['username'],
        action='ticket_update',
        target_type='ticket',
        target_id=id,
        detail=f"编辑工单 #{id}：{title}"
    )

    return get_ticket(id)


@tickets_bp.route('/<int:id>', methods=['DELETE'])
@require_permission('ticket:delete')
def delete_ticket(id):
    db = get_db()
    ticket = db.execute('SELECT * FROM tickets WHERE id = ?', (id,)).fetchone()
    if not ticket:
        return jsonify({'error': '工单不存在'}), 404

    user = get_current_user()
    create_operation_log(
        db,
        user_id=user['id'],
        username=user['username'],
        action='ticket_delete',
        target_type='ticket',
        target_id=id,
        detail=f"删除工单 #{id}：{ticket['title']}"
    )

    db.execute('DELETE FROM ticket_history WHERE ticket_id = ?', (id,))
    db.execute('DELETE FROM tickets WHERE id = ?', (id,))
    db.commit()
    return jsonify({'message': '删除成功'}), 200


@tickets_bp.route('/<int:id>/history', methods=['GET'])
@require_permission('ticket:read')
def ticket_history(id):
    db = get_db()
    rows = db.execute('''SELECT h.*, u.username as changed_by_name
                         FROM ticket_history h
                         LEFT JOIN users u ON h.changed_by = u.id
                         WHERE h.ticket_id = ?
                         ORDER BY h.changed_at DESC''', (id,)).fetchall()
    result = []
    for r in rows:
        result.append({
            'id': r['id'],
            'ticket_id': r['ticket_id'],
            'field': r['field'],
            'old_value': r['old_value'],
            'new_value': r['new_value'],
            'changed_by': r['changed_by'],
            'changed_by_name': r['changed_by_name'],
            'changed_at': r['changed_at'],
        })
    return jsonify(result), 200
