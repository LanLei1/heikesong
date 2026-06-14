import os
import sqlite3
from datetime import datetime

DB_PATH = os.environ.get('DB_PATH', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tickets.db'))


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cur = conn.cursor()

    cur.executescript('''
    CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER NOT NULL,
        permission_id INTEGER NOT NULL,
        PRIMARY KEY (role_id, permission_id),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role_id INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS statuses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        color TEXT DEFAULT '#1677ff',
        sort_order INTEGER DEFAULT 0,
        is_default INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS status_transitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_status_id INTEGER,
        to_status_id INTEGER NOT NULL,
        FOREIGN KEY (from_status_id) REFERENCES statuses(id) ON DELETE CASCADE,
        FOREIGN KEY (to_status_id) REFERENCES statuses(id) ON DELETE CASCADE,
        UNIQUE(from_status_id, to_status_id)
    );

    CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        status_id INTEGER,
        priority TEXT DEFAULT 'medium',
        creator_id INTEGER NOT NULL,
        assignee_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (status_id) REFERENCES statuses(id) ON DELETE SET NULL,
        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS ticket_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        field TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_by INTEGER NOT NULL,
        changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id INTEGER,
        detail TEXT,
        ip_address TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    ''')

    # Seed initial data
    now = datetime.now().isoformat()

    # Roles
    cur.execute('INSERT OR IGNORE INTO roles (id, name, description) VALUES (1, ?, ?)',
                ('super_admin', '超级管理员，拥有所有权限'))
    cur.execute('INSERT OR IGNORE INTO roles (id, name, description) VALUES (2, ?, ?)',
                ('admin', '管理员，可管理工单和用户'))
    cur.execute('INSERT OR IGNORE INTO roles (id, name, description) VALUES (3, ?, ?)',
                ('user', '普通用户，可创建和查看工单'))

    # Permissions
    perms = [
        ('user:create', '创建用户'),
        ('user:read', '查看用户'),
        ('user:update', '修改用户'),
        ('user:delete', '删除用户'),
        ('role:manage', '管理角色和权限'),
        ('ticket:create', '创建工单'),
        ('ticket:read', '查看工单'),
        ('ticket:update', '修改工单'),
        ('ticket:delete', '删除工单'),
        ('status:manage', '管理工单状态'),
    ]
    for name, desc in perms:
        cur.execute('INSERT OR IGNORE INTO permissions (name, description) VALUES (?, ?)', (name, desc))

    # Assign all permissions to super_admin
    cur.execute('SELECT id FROM roles WHERE name = ?', ('super_admin',))
    super_admin_role_id = cur.fetchone()['id']
    cur.execute('SELECT id FROM permissions')
    for row in cur.fetchall():
        cur.execute('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
                    (super_admin_role_id, row['id']))

    # admin has most permissions except role:manage and user delete
    cur.execute('SELECT id FROM roles WHERE name = ?', ('admin',))
    admin_role_id = cur.fetchone()['id']
    admin_perm_names = [
        'user:create', 'user:read', 'user:update',
        'ticket:create', 'ticket:read', 'ticket:update', 'ticket:delete',
        'status:manage'
    ]
    for pname in admin_perm_names:
        cur.execute('SELECT id FROM permissions WHERE name = ?', (pname,))
        pid = cur.fetchone()['id']
        cur.execute('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
                    (admin_role_id, pid))

    # user only ticket create/read/update own
    cur.execute('SELECT id FROM roles WHERE name = ?', ('user',))
    user_role_id = cur.fetchone()['id']
    user_perm_names = ['ticket:create', 'ticket:read', 'ticket:update']
    for pname in user_perm_names:
        cur.execute('SELECT id FROM permissions WHERE name = ?', (pname,))
        pid = cur.fetchone()['id']
        cur.execute('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
                    (user_role_id, pid))

    # Default statuses
    statuses = [
        (1, '新建', '#1677ff', 1, 1),
        (2, '处理中', '#faad14', 2, 0),
        (3, '待反馈', '#722ed1', 3, 0),
        (4, '已解决', '#52c41a', 4, 0),
        (5, '已关闭', '#8c8c8c', 5, 0),
    ]
    for sid, name, color, order, is_default in statuses:
        cur.execute('''INSERT OR IGNORE INTO statuses (id, name, color, sort_order, is_default)
                       VALUES (?, ?, ?, ?, ?)''', (sid, name, color, order, is_default))

    # Default transitions: any -> any for flexibility, specific ones enforced optionally
    transitions = [
        (1, 2), (1, 5),
        (2, 3), (2, 4), (2, 5),
        (3, 2), (3, 4), (3, 5),
        (4, 5), (4, 2),
        (5, 1),
    ]
    for from_id, to_id in transitions:
        cur.execute('''INSERT OR IGNORE INTO status_transitions (from_status_id, to_status_id)
                       VALUES (?, ?)''', (from_id, to_id))

    # Default super admin user: admin / admin123
    from werkzeug.security import generate_password_hash
    cur.execute('''INSERT OR IGNORE INTO users (id, username, password_hash, role_id, is_active)
                   VALUES (1, ?, ?, ?, 1)''',
                ('admin', generate_password_hash('admin123'), super_admin_role_id))

    conn.commit()
    conn.close()


def create_operation_log(db, user_id, username, action, target_type=None, target_id=None, detail=None, ip_address=None):
    db.execute('''INSERT INTO operation_logs
                  (user_id, username, action, target_type, target_id, detail, ip_address)
                  VALUES (?, ?, ?, ?, ?, ?, ?)''',
               (user_id, username, action, target_type, target_id, detail, ip_address))
    db.commit()


if __name__ == '__main__':
    init_db()
    print('Database initialized at', DB_PATH)
