from functools import wraps
from flask import request, jsonify
from flask_jwt_extended import create_access_token, get_jwt_identity, verify_jwt_in_request
from werkzeug.security import check_password_hash, generate_password_hash
from models import get_db


def authenticate(username, password):
    db = get_db()
    user = db.execute('''SELECT u.*, r.name as role_name FROM users u
                         LEFT JOIN roles r ON u.role_id = r.id
                         WHERE u.username = ?''', (username,)).fetchone()
    if user and user['is_active'] and check_password_hash(user['password_hash'], password):
        return user
    return None


def login_user(username, password):
    user = authenticate(username, password)
    if not user:
        return None
    access_token = create_access_token(identity=str(user['id']))
    return {
        'access_token': access_token,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'role_id': user['role_id'],
            'role_name': user['role_name'],
            'is_active': user['is_active'],
        }
    }


def hash_password(password):
    return generate_password_hash(password)


def get_current_user():
    user_id = int(get_jwt_identity())
    db = get_db()
    user = db.execute('''SELECT u.*, r.name as role_name FROM users u
                         LEFT JOIN roles r ON u.role_id = r.id
                         WHERE u.id = ?''', (user_id,)).fetchone()
    return user


def has_permission(user_id, permission_name):
    db = get_db()
    row = db.execute('''SELECT 1 FROM users u
                         JOIN role_permissions rp ON u.role_id = rp.role_id
                         JOIN permissions p ON rp.permission_id = p.id
                         WHERE u.id = ? AND p.name = ?''', (user_id, permission_name)).fetchone()
    return row is not None


def require_permission(permission_name):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user = get_current_user()
            if not user:
                return jsonify({'error': '用户不存在'}), 401
            if user['role_name'] == 'super_admin' or has_permission(user['id'], permission_name):
                return fn(*args, **kwargs)
            return jsonify({'error': '没有权限执行此操作'}), 403
        return wrapper
    return decorator


def require_admin_or_super():
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user = get_current_user()
            if not user:
                return jsonify({'error': '用户不存在'}), 401
            if user['role_name'] in ('super_admin', 'admin'):
                return fn(*args, **kwargs)
            return jsonify({'error': '需要管理员权限'}), 403
        return wrapper
    return decorator


def require_super_admin():
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user = get_current_user()
            if not user:
                return jsonify({'error': '用户不存在'}), 401
            if user['role_name'] == 'super_admin':
                return fn(*args, **kwargs)
            return jsonify({'error': '需要超级管理员权限'}), 403
        return wrapper
    return decorator
