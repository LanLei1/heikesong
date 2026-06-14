# Docker 部署与多种启动方式设计文档

## 1. 目标

让工单管理系统支持四种启动方式，并为每种方式提供清晰、可复现的文档与自动化脚本：

1. 本地开发启动
2. Docker Compose 一键启动
3. Docker 镜像启动
4. 离线镜像部署

## 2. 现状

- 项目结构：React + Vite + TypeScript + Ant Design 前端，Flask + SQLite 后端。
- 已有 `docker-compose.yml`、`backend/Dockerfile`、`frontend/Dockerfile`、`README.md`。
- 当前文档对 Docker 单独镜像启动、离线部署、数据备份恢复、故障排查覆盖不足。
- 缺少统一的构建脚本和发布包生成流程。

## 3. 启动方式设计

### 3.1 本地开发启动

**前端**

```bash
cd frontend
npm install
npm run dev
```

**后端**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

- 前端默认地址：`http://localhost:5173`
- 后端默认地址：`http://localhost:5000`
- 适用场景：开发调试、功能验证、Bug 修复

### 3.2 Docker Compose 一键启动

```bash
# 启动
docker compose up -d

# 停止
docker compose down

# 查看日志
docker compose logs -f
```

- 访问入口：`http://localhost`
- 默认账号：`admin` / `admin123`
- 数据持久化：`./data/tickets.db` 挂载到后端容器 `/data/tickets.db`
- 适用场景：演示环境、测试环境、快速部署

### 3.3 Docker 镜像启动

```bash
# 构建镜像
docker build -t ticket-backend ./backend
docker build -t ticket-frontend ./frontend

# 运行镜像
docker run -d --name ticket-backend -p 5000:5000 -v ./data:/data ticket-backend
docker run -d --name ticket-frontend -p 80:80 ticket-frontend
```

- 适用场景：客户环境、独立部署、CI/CD

### 3.4 离线镜像部署

```bash
# 导出镜像
docker save ticket-backend:latest -o ticket-backend.tar
docker save ticket-frontend:latest -o ticket-frontend.tar

# 在目标环境导入镜像
docker load -i ticket-backend.tar
docker load -i ticket-frontend.tar

# 启动
docker compose up -d
```

- 适用场景：无外网环境、医院环境、客户内网环境

## 4. Dockerfile 优化

### 4.1 后端 `backend/Dockerfile`

- 基础镜像：`python:3.11-slim`
- 新增非 root 用户 `appuser`
- 新增 `HEALTHCHECK` 检查根路径 `/`
- 环境变量 `DB_PATH=/data/tickets.db`
- 挂载卷：`/data`
- 新增 `backend/.dockerignore`，排除 `venv/`、`__pycache__/`、`*.db`、`*.pyc`、`.env` 等

### 4.2 前端 `frontend/Dockerfile`

- 保持 Node 多阶段构建 + Nginx 最终结构
- 新增 `frontend/nginx.conf`：gzip 压缩、静态资源缓存、404 回退到 `index.html`、自定义错误页
- 新增 `frontend/.dockerignore`，排除 `node_modules/`、`dist/`、`.git` 等

## 5. 自动构建脚本

### 5.1 `build.sh`（Linux / macOS / WSL / Git Bash）

功能：

1. 检查 `docker` 是否可用
2. 前端构建（可选，镜像内也会构建）
3. 后端依赖检查
4. Docker 镜像构建：`ticket-backend`、`ticket-frontend`
5. 镜像导出为 `ticket-backend.tar`、`ticket-frontend.tar`
6. 生成 `release/` 发布包

### 5.2 `build.ps1`（Windows PowerShell）

功能与 `build.sh` 一致。

## 6. 发布包目录结构

```
release/
├── ticket-backend.tar
├── ticket-frontend.tar
├── docker-compose.yml
├── .env.example
├── DEPLOY.md
├── README.md
└── VERSION
```

说明：

- `ticket-backend.tar` / `ticket-frontend.tar`：离线部署使用的镜像包
- `docker-compose.yml`：服务编排文件
- `.env.example`：环境变量模板
- `DEPLOY.md`：完整部署文档
- `README.md`：项目简介
- `VERSION`：当前版本号

## 7. 文档规划

### 7.1 `DEPLOY.md`

必须包含：

- 本地启动
- Docker Compose 启动
- Docker 镜像启动
- 离线部署
- 数据备份
- 数据恢复
- 常见故障排查

### 7.2 `OFFLINE_DEPLOY.md`

必须包含：

- 离线安装步骤
- 镜像导入步骤
- 启动步骤
- 升级步骤
- 回滚步骤

## 8. 验证计划

1. **本地开发启动**：按文档步骤启动前后端，确认登录页和功能正常。
2. **Docker Compose 启动**：执行 `docker compose up -d`，访问 `http://localhost` 验证。
3. **Docker 镜像启动**：分别构建并运行前后端镜像，验证接口和页面正常。
4. **构建脚本**：执行 `build.sh` / `build.ps1`，确认生成完整的 `release/` 目录。
5. **离线部署**：在清理本地镜像后，使用 `release/` 中的 `tar` 镜像执行 `docker load` + `docker compose up -d`，确认系统可独立运行。

## 9. 风险与注意事项

- **SQLite 并发**：离线部署同样受 SQLite 写入并发限制，文档中需提示生产高并发场景迁移至 PostgreSQL/MySQL。
- **端口占用**：`80` 和 `5000` 端口可能被占用，文档需提供排查和修改端口的方法。
- **数据备份**：容器销毁后数据依赖卷挂载，文档需强调 `data/` 目录备份。
- **Windows 路径**：PowerShell 脚本中路径处理需注意与 Linux 的差异。

## 10. 变更文件清单

- `backend/Dockerfile`（优化）
- `backend/.dockerignore`（新增）
- `frontend/Dockerfile`（优化）
- `frontend/.dockerignore`（新增）
- `frontend/nginx.conf`（新增/优化）
- `docker-compose.yml`（可能微调）
- `.env.example`（新增）
- `build.sh`（新增）
- `build.ps1`（新增）
- `DEPLOY.md`（新增）
- `OFFLINE_DEPLOY.md`（新增）
- `README.md`（更新，增加文档入口链接）
