from flask import Blueprint, request, jsonify
from models import get_db, create_operation_log
from auth import (require_permission, require_super_admin, get_current_user,
                  hash_password, has_permission)

users_bp = Blueprint('users', __name__)


def _user_to_dict(row):
    return {
        'id': row['id'],
        'username': row['username'],
        'role_id': row['role_id'],
        'role_name': row['role_name'],
        'is_active': bool(row['is_active']),
        'created_at': row['created_at'],
    }


@users_bp.route('', methods=['GET'])
@require_permission('user:read')
def list_users():
    db = get_db()
    rows = db.execute('''SELECT u.*, r.name as role_name FROM users u
                         LEFT JOIN roles r ON u.role_id = r.id
                         ORDER BY u.created_at DESC''').fetchall()
    return jsonify([_user_to_dict(r) for r in rows]), 200


@users_bp.route('/<int:id>', methods=['GET'])
@require_permission('user:read')
def get_user(id):
    db = get_db()
    row = db.execute('''SELECT u.*, r.name as role_name FROM users u
                        LEFT JOIN roles r ON u.role_id = r.id
                        WHERE u.id = ?''', (id,)).fetchone()
    if not row:
        return jsonify({'error': '用户不存在'}), 404
    return jsonify(_user_to_dict(row)), 200


@users_bp.route('', methods=['POST'])
@require_permission('user:create')
def create_user():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')
    role_id = data.get('role_id')
    is_active = 1 if data.get('is_active', True) else 0

    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400
    if len(password) < 6:
        return jsonify({'error': '密码长度不能少于6位'}), 400

    db = get_db()
    # Only super admin can assign super_admin role
    if role_id:
        role = db.execute('SELECT * FROM roles WHERE id = ?', (role_id,)).fetchone()
        if not role:
            return jsonify({'error': '角色不存在'}), 400
        current = get_current_user()
        if role['name'] == 'super_admin' and current['role_name'] != 'super_admin':
            return jsonify({'error': '只有超级管理员能创建超级管理员'}), 403

    try:
        cur = db.execute('''INSERT INTO users (username, password_hash, role_id, is_active)
                            VALUES (?, ?, ?, ?)''',
                         (username, hash_password(password), role_id, is_active))
        db.commit()
    except Exception:
        return jsonify({'error': '用户名已存在'}), 400

    current = get_current_user()
    create_operation_log(
        db,
        user_id=current['id'],
        username=current['username'],
        action='user_create',
        target_type='user',
        target_id=cur.lastrowid,
        detail=f"创建用户：{username}"
    )

    return get_user(cur.lastrowid)


@users_bp.route('/<int:id>', methods=['PUT'])
@require_permission('user:update')
def update_user(id):
    data = request.get_json() or {}
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE id = ?', (id,)).fetchone()
    if not user:
        return jsonify({'error': '用户不存在'}), 404

    current = get_current_user()
    target_role_id = data.get('role_id', user['role_id'])
    target_role = db.execute('SELECT * FROM roles WHERE id = ?', (target_role_id,)).fetchone()

    # Cannot modify super admin unless you are super admin
    target_is_super = target_role and target_role['name'] == 'super_admin'
    existing_role = db.execute('SELECT * FROM roles WHERE id = ?', (user['role_id'],)).fetchone()
    existing_is_super = existing_role and existing_role['name'] == 'super_admin'

    if (existing_is_super or target_is_super) and current['role_name'] != 'super_admin':
        return jsonify({'error': '没有权限修改超级管理员'}), 403

    username = data.get('username', user['username']).strip()
    password = data.get('password')
    is_active = 1 if data.get('is_active', user['is_active']) else 0

    if not username:
        return jsonify({'error': '用户名不能为空'}), 400

    password_hash = hash_password(password) if password else user['password_hash']
    try:
        db.execute('''UPDATE users SET username = ?, password_hash = ?, role_id = ?, is_active = ?
                      WHERE id = ?''',
                   (username, password_hash, target_role_id, is_active, id))
        db.commit()
    except Exception:
        return jsonify({'error': '用户名已存在'}), 400

    create_operation_log(
        db,
        user_id=current['id'],
        username=current['username'],
        action='user_update',
        target_type='user',
        target_id=id,
        detail=f"更新用户 #{id}：{username}" + ('（含密码重置）' if password else '')
    )

    return get_user(id)


@users_bp.route('/<int:id>', methods=['DELETE'])
@require_permission('user:delete')
def delete_user(id):
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE id = ?', (id,)).fetchone()
    if not user:
        return jsonify({'error': '用户不存在'}), 404
    current = get_current_user()
    role = db.execute('SELECT * FROM roles WHERE id = ?', (user['role_id'],)).fetchone()
    if role and role['name'] == 'super_admin' and current['role_name'] != 'super_admin':
        return jsonify({'error': '不能删除超级管理员'}), 403
    if user['id'] == current['id']:
        return jsonify({'error': '不能删除当前登录用户'}), 400
    db.execute('DELETE FROM users WHERE id = ?', (id,))
    db.commit()

    create_operation_log(
        db,
        user_id=current['id'],
        username=current['username'],
        action='user_delete',
        target_type='user',
        target_id=id,
        detail=f"删除用户 #{id}：{user['username']}"
    )

    return jsonify({'message': '删除成功'}), 200


@users_bp.route('/roles', methods=['GET'])
@require_permission('user:read')
def list_roles():
    db = get_db()
    rows = db.execute('SELECT * FROM roles ORDER BY id').fetchall()
    return jsonify([{'id': r['id'], 'name': r['name'], 'description': r['description']} for r in rows]), 200


@users_bp.route('/permissions', methods=['GET'])
@require_super_admin()
def list_permissions():
    db = get_db()
    rows = db.execute('SELECT * FROM permissions ORDER BY id').fetchall()
    result = []
    for r in rows:
        result.append({
            'id': r['id'],
            'name': r['name'],
            'description': r['description'],
        })
    return jsonify(result), 200


@users_bp.route('/roles/<int:role_id>/permissions', methods=['GET'])
@require_super_admin()
def get_role_permissions(role_id):
    db = get_db()
    rows = db.execute('''SELECT p.id, p.name, p.description FROM role_permissions rp
                         JOIN permissions p ON rp.permission_id = p.id
                         WHERE rp.role_id = ?''', (role_id,)).fetchall()
    return jsonify([{'id': r['id'], 'name': r['name'], 'description': r['description']} for r in rows]), 200


@users_bp.route('/roles/<int:role_id>/permissions', methods=['PUT'])
@require_super_admin()
def set_role_permissions(role_id):
    data = request.get_json() or {}
    permission_ids = data.get('permission_ids', [])
    db = get_db()
    role = db.execute('SELECT * FROM roles WHERE id = ?', (role_id,)).fetchone()
    if not role:
        return jsonify({'error': '角色不存在'}), 404
    db.execute('DELETE FROM role_permissions WHERE role_id = ?', (role_id,))
    for pid in permission_ids:
        db.execute('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
                   (role_id, pid))
    db.commit()

    current = get_current_user()
    create_operation_log(
        db,
        user_id=current['id'],
        username=current['username'],
        action='permission_update',
        target_type='role',
        target_id=role_id,
        detail=f"更新角色 #{role_id}（{role['name']}）权限，共 {len(permission_ids)} 项"
    )

    return get_role_permissions(role_id)
