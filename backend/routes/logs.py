from flask import Blueprint, request, jsonify
from models import get_db
from auth import require_permission, get_current_user

logs_bp = Blueprint('logs', __name__)


@logs_bp.route('', methods=['GET'])
@require_permission('role:manage')
def list_logs():
    db = get_db()
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 20, type=int)
    if page < 1:
        page = 1
    if page_size < 1 or page_size > 100:
        page_size = 20

    keyword = request.args.get('keyword', '').strip()
    action = request.args.get('action', '').strip()

    sql = 'SELECT * FROM operation_logs WHERE 1=1'
    params = []
    if keyword:
        sql += ' AND (username LIKE ? OR detail LIKE ? OR action LIKE ?)'
        params.extend([f'%{keyword}%', f'%{keyword}%', f'%{keyword}%'])
    if action:
        sql += ' AND action = ?'
        params.append(action)
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.extend([page_size, (page - 1) * page_size])

    rows = db.execute(sql, params).fetchall()
    result = []
    for r in rows:
        result.append({
            'id': r['id'],
            'user_id': r['user_id'],
            'username': r['username'],
            'action': r['action'],
            'target_type': r['target_type'],
            'target_id': r['target_id'],
            'detail': r['detail'],
            'ip_address': r['ip_address'],
            'created_at': r['created_at'],
        })

    count_sql = 'SELECT COUNT(*) as total FROM operation_logs WHERE 1=1'
    count_params = []
    if keyword:
        count_sql += ' AND (username LIKE ? OR detail LIKE ? OR action LIKE ?)'
        count_params.extend([f'%{keyword}%', f'%{keyword}%', f'%{keyword}%'])
    if action:
        count_sql += ' AND action = ?'
        count_params.append(action)
    total = db.execute(count_sql, count_params).fetchone()['total']

    return jsonify({'items': result, 'total': total, 'page': page, 'page_size': page_size}), 200
