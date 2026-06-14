from flask import Blueprint, request, jsonify
from auth import login_user, get_current_user
from flask_jwt_extended import jwt_required
from models import get_db, create_operation_log

auth_bp = Blueprint('auth', __name__)


def _get_ip():
    return request.headers.get('X-Forwarded-For', request.remote_addr)


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')
    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400
    result = login_user(username, password)
    if not result:
        return jsonify({'error': '用户名或密码错误'}), 401

    db = get_db()
    create_operation_log(
        db,
        user_id=result['user']['id'],
        username=result['user']['username'],
        action='login',
        target_type='auth',
        detail=f"用户 {result['user']['username']} 登录系统",
        ip_address=_get_ip()
    )
    return jsonify(result), 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    user = get_current_user()
    if user:
        db = get_db()
        create_operation_log(
            db,
            user_id=user['id'],
            username=user['username'],
            action='logout',
            target_type='auth',
            detail=f"用户 {user['username']} 退出登录",
            ip_address=_get_ip()
        )
    return jsonify({'message': '退出成功'}), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user = get_current_user()
    if not user:
        return jsonify({'error': '用户不存在'}), 401
    return jsonify({
        'id': user['id'],
        'username': user['username'],
        'role_id': user['role_id'],
        'role_name': user['role_name'],
        'is_active': user['is_active'],
    }), 200
