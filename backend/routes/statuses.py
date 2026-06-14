from flask import Blueprint, request, jsonify
from datetime import datetime
from models import get_db, create_operation_log
from auth import require_permission, get_current_user, require_admin_or_super

statuses_bp = Blueprint('statuses', __name__)


def _status_to_dict(row):
    return {
        'id': row['id'],
        'name': row['name'],
        'color': row['color'],
        'sort_order': row['sort_order'],
        'is_default': bool(row['is_default']),
        'created_at': row['created_at'],
    }


@statuses_bp.route('', methods=['GET'])
@require_permission('ticket:read')
def list_statuses():
    db = get_db()
    rows = db.execute('SELECT * FROM statuses ORDER BY sort_order, id').fetchall()
    return jsonify([_status_to_dict(r) for r in rows]), 200


@statuses_bp.route('', methods=['POST'])
@require_permission('status:manage')
def create_status():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    color = data.get('color', '#1677ff').strip()
    sort_order = data.get('sort_order', 0)
    if not name:
        return jsonify({'error': '状态名称不能为空'}), 400
    db = get_db()
    user = get_current_user()
    try:
        cur = db.execute('INSERT INTO statuses (name, color, sort_order) VALUES (?, ?, ?)',
                         (name, color, sort_order))
        db.commit()
    except Exception as e:
        return jsonify({'error': '状态名称已存在'}), 400

    create_operation_log(
        db,
        user_id=user['id'],
        username=user['username'],
        action='status_create',
        target_type='status',
        target_id=cur.lastrowid,
        detail=f"创建状态：{name}"
    )

    row = db.execute('SELECT * FROM statuses WHERE id = ?', (cur.lastrowid,)).fetchone()
    return jsonify(_status_to_dict(row)), 201


@statuses_bp.route('/<int:id>', methods=['PUT'])
@require_permission('status:manage')
def update_status(id):
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    color = data.get('color', '').strip()
    sort_order = data.get('sort_order')
    if not name:
        return jsonify({'error': '状态名称不能为空'}), 400
    db = get_db()
    existing = db.execute('SELECT * FROM statuses WHERE id = ?', (id,)).fetchone()
    if not existing:
        return jsonify({'error': '状态不存在'}), 404
    user = get_current_user()
    try:
        db.execute('UPDATE statuses SET name = ?, color = ?, sort_order = ? WHERE id = ?',
                   (name, color if color else existing['color'], sort_order if sort_order is not None else existing['sort_order'], id))
        db.commit()
    except Exception:
        return jsonify({'error': '状态名称已存在'}), 400

    create_operation_log(
        db,
        user_id=user['id'],
        username=user['username'],
        action='status_update',
        target_type='status',
        target_id=id,
        detail=f"更新状态 #{id}：{name}"
    )

    row = db.execute('SELECT * FROM statuses WHERE id = ?', (id,)).fetchone()
    return jsonify(_status_to_dict(row)), 200


@statuses_bp.route('/<int:id>', methods=['DELETE'])
@require_permission('status:manage')
def delete_status(id):
    db = get_db()
    row = db.execute('SELECT * FROM statuses WHERE id = ?', (id,)).fetchone()
    if not row:
        return jsonify({'error': '状态不存在'}), 404
    if row['is_default']:
        return jsonify({'error': '默认状态不能删除'}), 400
    user = get_current_user()
    # Reassign tickets to default status
    default = db.execute('SELECT id FROM statuses WHERE is_default = 1 LIMIT 1').fetchone()
    if default:
        db.execute('UPDATE tickets SET status_id = ? WHERE status_id = ?', (default['id'], id))
    db.execute('DELETE FROM status_transitions WHERE from_status_id = ? OR to_status_id = ?', (id, id))
    db.execute('DELETE FROM statuses WHERE id = ?', (id,))
    db.commit()

    create_operation_log(
        db,
        user_id=user['id'],
        username=user['username'],
        action='status_delete',
        target_type='status',
        target_id=id,
        detail=f"删除状态 #{id}：{row['name']}"
    )

    return jsonify({'message': '删除成功'}), 200


@statuses_bp.route('/transitions', methods=['GET'])
@require_permission('ticket:read')
def list_transitions():
    db = get_db()
    rows = db.execute('''SELECT st.id, st.from_status_id, st.to_status_id,
                                fs.name as from_name, ts.name as to_name
                         FROM status_transitions st
                         LEFT JOIN statuses fs ON st.from_status_id = fs.id
                         LEFT JOIN statuses ts ON st.to_status_id = ts.id''').fetchall()
    result = []
    for r in rows:
        result.append({
            'id': r['id'],
            'from_status_id': r['from_status_id'],
            'to_status_id': r['to_status_id'],
            'from_name': r['from_name'],
            'to_name': r['to_name'],
        })
    return jsonify(result), 200


@statuses_bp.route('/transitions', methods=['POST'])
@require_permission('status:manage')
def create_transition():
    data = request.get_json() or {}
    from_status_id = data.get('from_status_id')
    to_status_id = data.get('to_status_id')
    if to_status_id is None:
        return jsonify({'error': '目标状态不能为空'}), 400
    db = get_db()
    user = get_current_user()
    try:
        db.execute('INSERT INTO status_transitions (from_status_id, to_status_id) VALUES (?, ?)',
                   (from_status_id, to_status_id))
        db.commit()
    except Exception:
        return jsonify({'error': '流转规则已存在或数据错误'}), 400

    create_operation_log(
        db,
        user_id=user['id'],
        username=user['username'],
        action='transition_create',
        target_type='transition',
        detail=f"添加流转规则：{from_status_id} -> {to_status_id}"
    )

    return jsonify({'message': '添加成功'}), 201


@statuses_bp.route('/transitions/<int:id>', methods=['DELETE'])
@require_permission('status:manage')
def delete_transition(id):
    db = get_db()
    user = get_current_user()
    db.execute('DELETE FROM status_transitions WHERE id = ?', (id,))
    db.commit()

    create_operation_log(
        db,
        user_id=user['id'],
        username=user['username'],
        action='transition_delete',
        target_type='transition',
        target_id=id,
        detail=f"删除流转规则 #{id}"
    )

    return jsonify({'message': '删除成功'}), 200


@statuses_bp.route('/<int:from_id>/next', methods=['GET'])
@require_permission('ticket:read')
def next_statuses(from_id):
    db = get_db()
    # If no transitions defined from this status, allow any status (open workflow)
    rows = db.execute('''SELECT s.* FROM status_transitions st
                         JOIN statuses s ON st.to_status_id = s.id
                         WHERE st.from_status_id = ?
                         ORDER BY s.sort_order''', (from_id,)).fetchall()
    if not rows:
        rows = db.execute('SELECT * FROM statuses ORDER BY sort_order, id').fetchall()
    return jsonify([_status_to_dict(r) for r in rows]), 200
