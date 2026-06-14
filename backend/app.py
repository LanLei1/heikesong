import os
from flask import Flask, send_from_directory, request, jsonify
from datetime import timedelta
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from models import init_db
from routes.auth import auth_bp
from routes.tickets import tickets_bp
from routes.statuses import statuses_bp
from routes.users import users_bp
from routes.logs import logs_bp

app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'dev-secret-change-me')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=8)

CORS(app, resources={r"/api/*": {"origins": "*"}})
JWTManager(app)

init_db()

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(tickets_bp, url_prefix='/api/tickets')
app.register_blueprint(statuses_bp, url_prefix='/api/statuses')
app.register_blueprint(users_bp, url_prefix='/api/users')
app.register_blueprint(logs_bp, url_prefix='/api/logs')


@app.route('/')
def index():
    return {'message': 'Ticket Management System API'}


@app.errorhandler(500)
def handle_500(error):
    import traceback
    traceback.print_exc()
    if request.path.startswith('/api'):
        return jsonify({'error': '服务器内部错误', 'detail': str(error)}), 500
    return str(error), 500


@app.errorhandler(Exception)
def handle_exception(error):
    import traceback
    traceback.print_exc()
    if request.path.startswith('/api'):
        return jsonify({'error': '服务器内部错误', 'detail': str(error)}), 500
    return str(error), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
