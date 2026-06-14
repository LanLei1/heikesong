# 工单管理系统

一个基于 React + Vite + TypeScript + Ant Design 前端，Flask + SQLite 后端的轻量级工单管理系统，支持工单流转、状态管理、用户权限管理和操作日志。

## 功能列表

- **用户认证**：JWT 登录，支持登录/退出日志记录
- **首页看板**：展示工单总数、进行中/未关闭、高优先级、未分配处理人统计，状态分布和最近更新工单
- **工单管理**：
  - 创建、编辑、删除工单
  - 列表页直接下拉修改工单状态
  - 按状态、优先级、处理人、关键词筛选
  - 状态流转历史记录
- **状态管理**：自定义工单状态、颜色、排序和状态流转规则
- **用户管理**：创建、编辑、删除用户，分配角色
- **权限管理**：基于角色的权限分配（仅超级管理员）
- **操作日志**：记录登录、工单、状态、用户、权限等关键操作（仅超级管理员可见）
- **系统设置**：状态、用户、权限、操作日志统一收纳为二级菜单

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18、Vite 5、TypeScript 5、Ant Design 5、React Router 6、Axios |
| 后端 | Python 3.8+、Flask 3、Flask-JWT-Extended、Flask-CORS、Werkzeug、SQLite |
| 部署 | Docker、Docker Compose、Nginx |

## 安装方法

### 本地开发

1. 克隆项目后进入目录

```bash
cd ticket-system
```

2. 安装并启动后端

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
python app.py
```

后端默认运行在 `http://localhost:5000`。

3. 安装并启动前端

```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 `http://localhost:5173`。

### Docker 部署

1. 确保已安装 Docker 和 Docker Compose
2. 在项目根目录执行：

```bash
docker-compose up -d --build
```

3. 访问 `http://localhost`

默认账号：

- 用户名：`admin`
- 密码：`admin123`

## 部署方式

项目支持多种部署方式，详细说明请参考：

- [DEPLOY.md](DEPLOY.md) — 本地开发、Docker Compose、Docker 镜像、离线部署
- [OFFLINE_DEPLOY.md](OFFLINE_DEPLOY.md) — 无网络环境离线安装、升级、回滚

## 运行方法

### 开发模式

需要同时启动前后端两个服务：

```bash
# 终端 1：后端
cd backend
python app.py

# 终端 2：前端
cd frontend
npm run dev
```

然后浏览器打开 `http://localhost:5173`。

### 生产构建

```bash
cd frontend
npm run build
```

构建产物位于 `frontend/dist`，可通过 Nginx 等静态服务器部署。

### Docker 生产部署

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

数据会持久化到项目根目录的 `data/` 文件夹。

## 测试方法

### 接口测试

登录接口示例：

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

使用返回的 `access_token` 调用其他接口：

```bash
TOKEN=your_token_here
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/tickets
```

### 前端测试

```bash
cd frontend
npm run build
```

构建成功即表示 TypeScript 类型检查和打包通过。

### 已验证功能

- 管理员登录、普通用户登录
- 工单创建、编辑、状态变更、删除
- 状态管理、流转规则配置
- 用户创建、编辑、删除
- 权限配置
- 操作日志记录与查询
- 登录页响应式适配

## 已知问题

1. **数据库结构更新**：新增 `operation_logs` 表后，旧版 `tickets.db` 不会自动更新。如遇操作日志相关报错，请删除 `backend/tickets.db`（或 Docker 中的 `data/tickets.db`）后重启服务，系统会自动重新初始化。
2. **前端构建产物体积**：当前打包为单个 JS 文件，体积超过 500KB。后续可通过代码分割优化。
3. **并发写入**：SQLite 在高并发写入场景下可能出现锁等待，生产环境建议迁移至 PostgreSQL/MySQL。
4. **图片资源**：登录背景图较大（约 2MB），首次加载可能稍慢。

## 后续改进

- [ ] 引入真实图表库（ECharts/AntV）增强看板数据可视化
- [ ] 支持工单附件上传
- [ ] 增加工单评论/协作功能
- [ ] 引入邮箱/通知机制
- [ ] 后端数据库迁移至 PostgreSQL 并引入 ORM（如 SQLAlchemy）
- [ ] 前端代码分割与懒加载，优化首屏加载
- [ ] 增加单元测试和 E2E 测试
- [ ] 完善 Dockerfile 多阶段构建与生产环境安全配置
