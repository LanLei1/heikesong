# 部署指南

本文档介绍工单管理系统的多种部署方式，适用于开发、测试、演示和生产环境。

---

## 环境要求

### 本地开发环境

- Python 3.8+
- Node.js 20+
- npm 10+

### Docker 环境

- Docker 20.10+
- Docker Compose 2.20+

### 离线部署环境

- Docker 20.10+
- Docker Compose 2.20+
- 无需互联网连接

---

## 方式一：本地开发启动

适用于开发调试、功能验证和 Bug 修复。

### 启动后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

- 后端地址：`http://localhost:5000`
- 首次启动会自动初始化 SQLite 数据库

### 启动前端

在另一个终端执行：

```bash
cd frontend
npm install
npm run dev
```

- 前端地址：`http://localhost:5173`
- 开发服务器会自动代理 API 请求到后端

### 默认账号

- 用户名：`admin`
- 密码：`admin123`

---

## 方式二：Docker Compose 一键启动

适用于演示环境、测试环境和快速部署。

### 启动

```bash
docker compose up -d
```

### 停止

```bash
docker compose down
```

### 查看日志

```bash
docker compose logs -f
```

### 访问

- 系统入口：`http://localhost`
- 后端 API：`http://localhost:5000`

### 默认账号

- 用户名：`admin`
- 密码：`admin123`

### 数据持久化

SQLite 数据库文件挂载在项目根目录的 `data/` 文件夹中：

```
data/
└── tickets.db
```

---

## 方式三：Docker 镜像启动

适用于客户环境、独立部署和 CI/CD 流水线。

### 构建镜像

```bash
docker build -t ticket-backend ./backend
docker build -t ticket-frontend ./frontend
```

### 运行镜像

#### 后端

```bash
docker run -d --name ticket-backend \
  -p 5000:5000 \
  -v ./data:/data \
  -e JWT_SECRET_KEY=change-me-in-production \
  ticket-backend
```

#### 前端

```bash
docker run -d --name ticket-frontend \
  -p 80:80 \
  --link ticket-backend:backend \
  ticket-frontend
```

### 访问

- 系统入口：`http://localhost`
- 后端 API：`http://localhost:5000`

---

## 方式四：离线镜像部署

适用于无外网环境、医院环境、客户内网环境。

### 准备离线包

在有网络的环境中执行构建脚本：

```bash
# Linux / macOS / WSL / Git Bash
./build.sh 1.0.0

# Windows PowerShell
.\build.ps1 -Version 1.0.0
```

生成的 `release/` 目录包含：

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

### 导出镜像（手动方式）

```bash
docker save ticket-backend:latest -o ticket-backend.tar
docker save ticket-frontend:latest -o ticket-frontend.tar
```

### 在目标环境导入镜像

将 `release/` 目录复制到目标机器后执行：

```bash
cd release
docker load -i ticket-backend.tar
docker load -i ticket-frontend.tar
```

### 启动

```bash
cd release
docker compose up -d
```

详细离线部署说明请参考：[OFFLINE_DEPLOY.md](OFFLINE_DEPLOY.md)

---

## 数据备份

数据库文件位于 `data/tickets.db`，定期备份该文件即可：

```bash
# 备份
cp -r data data-backup-$(date +%Y%m%d)

# 或压缩备份
tar -czvf ticket-backup-$(date +%Y%m%d).tar.gz data/
```

---

## 数据恢复

1. 停止服务：

```bash
docker compose down
```

2. 恢复数据：

```bash
rm -rf data
tar -xzvf ticket-backup-YYYYMMDD.tar.gz
```

3. 重新启动：

```bash
docker compose up -d
```

---

## 常见故障排查

### 端口被占用

如果 `80` 或 `5000` 端口被占用，修改 `docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "8080:80"   # 前端改为 8080
```

```yaml
ports:
  - "5001:5000" # 后端改为 5001
```

### 数据库结构更新后报错

如果新增表结构后旧数据库不兼容，删除旧数据库后重启：

```bash
rm data/tickets.db
docker compose up -d
```

**注意**：删除数据库会清空数据，操作前请先备份。

### 镜像未找到

执行 `docker compose up -d` 时如果提示镜像不存在，先构建镜像：

```bash
docker compose up -d --build
```

### 数据卷权限问题

在 Linux 上，容器内的非 root 用户可能无法写入挂载的 `data/` 目录。可以手动设置目录权限：

```bash
mkdir -p data
chmod 777 data
```

### 前端页面刷新后 404

Nginx 配置已包含 React Router 回退。如仍出现 404，请确认 `frontend/nginx.conf` 中的 `try_files` 配置正确。

### 无法连接 Docker Hub

如果 Docker 镜像拉取失败，请配置 Docker 镜像加速器。参考 `daemon.json` 示例：

```json
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://docker.m.daocloud.io"
  ]
}
```

配置完成后重启 Docker Desktop。
