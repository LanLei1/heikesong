# Docker 部署与多种启动方式实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成工单管理系统的 Docker 部署改造，支持本地开发、Docker Compose、单独 Docker 镜像、离线镜像四种启动方式，并提供自动化构建脚本与完整部署文档。

**Architecture:** 保持现有 Flask + SQLite 后端和 React + Vite 前端结构不变，通过优化 Dockerfile、增加构建脚本、补充 Nginx 配置、新增部署文档来实现交付要求。构建脚本负责生成包含镜像 tar 包和文档的 `release/` 目录，便于离线部署。

**Tech Stack:** Docker、Docker Compose、Python 3.11、Node 20、Nginx、Bash、PowerShell

---

## 文件结构

| 文件 | 责任 |
|------|------|
| `backend/Dockerfile` | 后端容器镜像构建，非 root 用户、健康检查、数据卷挂载 |
| `backend/.dockerignore` | 减少后端镜像体积，排除 venv、__pycache__、db 等 |
| `frontend/Dockerfile` | 前端多阶段构建，输出到 Nginx |
| `frontend/.dockerignore` | 减少前端镜像体积，排除 node_modules、dist、.git 等 |
| `frontend/nginx.conf` | Nginx 服务配置：gzip、缓存、React Router 回退、错误页 |
| `docker-compose.yml` | 前后端服务编排 |
| `.env.example` | 环境变量模板 |
| `build.sh` | Linux/macOS/WSL 构建脚本：构建镜像、导出 tar、生成 release 包 |
| `build.ps1` | Windows PowerShell 构建脚本 |
| `DEPLOY.md` | 完整部署文档：四种启动方式、备份恢复、故障排查 |
| `OFFLINE_DEPLOY.md` | 离线部署专用文档：安装、导入、启动、升级、回滚 |
| `README.md` | 更新，增加部署文档入口链接 |

---

### Task 1: 优化后端 Dockerfile

**Files:**
- Modify: `backend/Dockerfile`
- Create: `backend/.dockerignore`

- [ ] **Step 1: 写入优化后的后端 Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN groupadd -r appgroup && useradd -r -g appgroup appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 5000

ENV FLASK_APP=app.py
ENV DB_PATH=/data/tickets.db

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/')" || exit 1

CMD ["python", "app.py"]
```

- [ ] **Step 2: 创建后端 .dockerignore**

```text
venv/
.env
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
*.db
*.sqlite3
.pytest_cache/
.mypy_cache/
.git/
.gitignore
README.md
Dockerfile
.dockerignore
```

- [ ] **Step 3: 构建后端镜像验证 Dockerfile 语法**

Run: `docker build -t ticket-backend ./backend`
Expected: 镜像构建成功，无错误。

- [ ] **Step 4: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore
git commit -m "build: optimize backend Dockerfile with non-root user and healthcheck"
```

---

### Task 2: 优化前端 Dockerfile 与 Nginx 配置

**Files:**
- Modify: `frontend/Dockerfile`
- Create: `frontend/.dockerignore`
- Create: `frontend/nginx.conf`

- [ ] **Step 1: 写入优化后的前端 Dockerfile**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "g", "daemon off;"]
```

- [ ] **Step 2: 创建前端 nginx.conf**

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

- [ ] **Step 3: 创建前端 .dockerignore**

```text
node_modules/
dist/
.git/
.gitignore
README.md
Dockerfile
.dockerignore
*.log
.vscode/
.idea/
```

- [ ] **Step 4: 构建前端镜像验证**

Run: `docker build -t ticket-frontend ./frontend`
Expected: 镜像构建成功，无错误。

- [ ] **Step 5: Commit**

```bash
git add frontend/Dockerfile frontend/.dockerignore frontend/nginx.conf
git commit -m "build: optimize frontend Dockerfile and add nginx config"
```

---

### Task 3: 更新 Docker Compose 配置

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: 更新 docker-compose.yml**

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    image: ticket-backend:latest
    container_name: ticket-backend
    ports:
      - "5000:5000"
    volumes:
      - ./data:/data
    environment:
      - JWT_SECRET_KEY=${JWT_SECRET_KEY:-change-me-in-production}
      - DB_PATH=/data/tickets.db
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:5000/')"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5s

  frontend:
    build: ./frontend
    image: ticket-frontend:latest
    container_name: ticket-frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5s
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "build: update docker-compose with healthchecks and explicit image names"
```

---

### Task 4: 创建环境变量模板

**Files:**
- Create: `.env.example`

- [ ] **Step 1: 写入 .env.example**

```text
# JWT 密钥，生产环境必须修改
JWT_SECRET_KEY=change-me-in-production

# 后端数据库路径（容器内）
DB_PATH=/data/tickets.db
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add .env.example for deployment configuration"
```

---

### Task 5: 创建 Linux/macOS 构建脚本 build.sh

**Files:**
- Create: `build.sh`

- [ ] **Step 1: 写入 build.sh**

```bash
#!/usr/bin/env bash
set -e

VERSION=${1:-1.0.0}
RELEASE_DIR="release"

BACKEND_IMAGE="ticket-backend:latest"
FRONTEND_IMAGE="ticket-frontend:latest"

echo "=== Ticket System Build Script ==="
echo "Version: $VERSION"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "Error: docker is not installed."
    exit 1
fi

# 清理旧发布包
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# 构建后端镜像
echo "=== Building backend image ==="
docker build -t "$BACKEND_IMAGE" ./backend

# 构建前端镜像
echo "=== Building frontend image ==="
docker build -t "$FRONTEND_IMAGE" ./frontend

# 导出镜像
echo "=== Saving images ==="
docker save "$BACKEND_IMAGE" -o "$RELEASE_DIR/ticket-backend.tar"
docker save "$FRONTEND_IMAGE" -o "$RELEASE_DIR/ticket-frontend.tar"

# 复制部署文件
cp docker-compose.yml "$RELEASE_DIR/"
cp .env.example "$RELEASE_DIR/"
cp DEPLOY.md "$RELEASE_DIR/" 2>/dev/null || true
cp README.md "$RELEASE_DIR/" 2>/dev/null || true
echo "$VERSION" > "$RELEASE_DIR/VERSION"

echo "=== Release package created at $RELEASE_DIR ==="
ls -lh "$RELEASE_DIR"
```

- [ ] **Step 2: 赋予执行权限**

Run: `chmod +x build.sh`

- [ ] **Step 3: Commit**

```bash
git add build.sh
git commit -m "build: add Linux/macOS build script for release packaging"
```

---

### Task 6: 创建 Windows 构建脚本 build.ps1

**Files:**
- Create: `build.ps1`

- [ ] **Step 1: 写入 build.ps1**

```powershell
param(
    [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"

$ReleaseDir = "release"
$BackendImage = "ticket-backend:latest"
$FrontendImage = "ticket-frontend:latest"

Write-Host "=== Ticket System Build Script ==="
Write-Host "Version: $Version"

# 检查 Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Error: docker is not installed."
    exit 1
}

# 清理旧发布包
if (Test-Path $ReleaseDir) {
    Remove-Item -Recurse -Force $ReleaseDir
}
New-Item -ItemType Directory -Path $ReleaseDir | Out-Null

# 构建后端镜像
Write-Host "=== Building backend image ==="
docker build -t $BackendImage ./backend

# 构建前端镜像
Write-Host "=== Building frontend image ==="
docker build -t $FrontendImage ./frontend

# 导出镜像
Write-Host "=== Saving images ==="
docker save $BackendImage -o "$ReleaseDir/ticket-backend.tar"
docker save $FrontendImage -o "$ReleaseDir/ticket-frontend.tar"

# 复制部署文件
Copy-Item docker-compose.yml $ReleaseDir/
Copy-Item .env.example $ReleaseDir/
if (Test-Path DEPLOY.md) { Copy-Item DEPLOY.md $ReleaseDir/ }
if (Test-Path README.md) { Copy-Item README.md $ReleaseDir/ }
$Version | Out-File -FilePath "$ReleaseDir/VERSION" -Encoding utf8

Write-Host "=== Release package created at $ReleaseDir ==="
Get-ChildItem $ReleaseDir
```

- [ ] **Step 2: Commit**

```bash
git add build.ps1
git commit -m "build: add Windows PowerShell build script for release packaging"
```

---

### Task 7: 创建 DEPLOY.md 部署文档

**Files:**
- Create: `DEPLOY.md`

- [ ] **Step 1: 写入 DEPLOY.md**

内容需包含：
- 环境要求
- 方式一：本地开发启动（前后端命令）
- 方式二：Docker Compose 一键启动（启动/停止/日志）
- 方式三：Docker 镜像启动（构建/运行命令）
- 方式四：离线镜像部署（导出/导入/启动）
- 数据备份（复制 data/ 目录）
- 数据恢复（复制 data/ 目录回原位）
- 常见故障排查（端口占用、权限、镜像未找到、数据库结构更新）

具体文本参照 spec 中 DEPLOY.md 要求撰写，确保命令可复制执行。

- [ ] **Step 2: Commit**

```bash
git add DEPLOY.md
git commit -m "docs: add DEPLOY.md with four deployment methods"
```

---

### Task 8: 创建 OFFLINE_DEPLOY.md 离线部署文档

**Files:**
- Create: `OFFLINE_DEPLOY.md`

- [ ] **Step 1: 写入 OFFLINE_DEPLOY.md**

内容需包含：
- 离线安装前提（Docker、Docker Compose 已安装）
- 镜像导入步骤（`docker load -i`）
- 启动步骤（`docker compose up -d`）
- 升级步骤（备份数据、加载新镜像、重启）
- 回滚步骤（恢复旧镜像 tar、重新加载、重启）

具体文本参照 spec 中 OFFLINE_DEPLOY.md 要求撰写。

- [ ] **Step 2: Commit**

```bash
git add OFFLINE_DEPLOY.md
git commit -m "docs: add OFFLINE_DEPLOY.md for air-gapped deployment"
```

---

### Task 9: 更新 README.md 入口

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 在 README.md 安装方法或运行方法章节增加指向 DEPLOY.md 的链接**

示例新增内容：

```markdown
## 部署方式

项目支持多种部署方式，详细说明请参考：

- [DEPLOY.md](DEPLOY.md) — 本地开发、Docker Compose、Docker 镜像、离线部署
- [OFFLINE_DEPLOY.md](OFFLINE_DEPLOY.md) — 无网络环境离线安装、升级、回滚
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with deployment documentation links"
```

---

### Task 10: 本地开发启动验证

**Files:**
- Test: 手动验证

- [ ] **Step 1: 启动后端**

Run:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Expected: 后端运行在 `http://localhost:5000`，无报错。

- [ ] **Step 2: 启动前端**

Run:
```bash
cd frontend
npm install
npm run dev
```

Expected: 前端运行在 `http://localhost:5173`，浏览器可打开登录页。

- [ ] **Step 3: 登录并验证核心功能**

Run:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Expected: 返回包含 `access_token` 的 JSON。

---

### Task 11: Docker Compose 启动验证

**Files:**
- Test: 手动验证

- [ ] **Step 1: 清理旧容器（如存在）**

Run: `docker compose down --volumes --remove-orphans`

- [ ] **Step 2: 一键启动**

Run: `docker compose up -d --build`

Expected: `ticket-backend` 和 `ticket-frontend` 容器状态为 `Up`。

- [ ] **Step 3: 查看日志**

Run: `docker compose logs -f`

Expected: 无持续报错，健康检查通过。

- [ ] **Step 4: 访问验证**

Run: `curl http://localhost`
Expected: 返回 Nginx 服务的前端 HTML。

Run: `curl http://localhost:5000/`
Expected: 返回 `{"message":"Ticket Management System API"}`。

- [ ] **Step 5: 停止服务**

Run: `docker compose down`

---

### Task 12: Docker 镜像单独启动验证

**Files:**
- Test: 手动验证

- [ ] **Step 1: 构建镜像**

Run:
```bash
docker build -t ticket-backend ./backend
docker build -t ticket-frontend ./frontend
```

Expected: 两个镜像构建成功。

- [ ] **Step 2: 运行后端镜像**

Run:
```bash
docker run -d --name ticket-backend -p 5000:5000 -v ./data:/data ticket-backend
```

Expected: 容器运行，访问 `http://localhost:5000/` 返回 API 信息。

- [ ] **Step 3: 运行前端镜像**

Run:
```bash
docker run -d --name ticket-frontend -p 80:80 ticket-frontend
```

Expected: 容器运行，访问 `http://localhost` 返回前端页面。

- [ ] **Step 4: 清理容器**

Run:
```bash
docker stop ticket-backend ticket-frontend
docker rm ticket-backend ticket-frontend
```

---

### Task 13: 构建脚本验证

**Files:**
- Test: 手动验证

- [ ] **Step 1: 运行 build.sh**

Run:
```bash
./build.sh 1.0.0
```

Expected: 生成 `release/` 目录，包含：
- `ticket-backend.tar`
- `ticket-frontend.tar`
- `docker-compose.yml`
- `.env.example`
- `DEPLOY.md`
- `README.md`
- `VERSION`

- [ ] **Step 2: 检查镜像导出是否可用**

Run:
```bash
docker load -i release/ticket-backend.tar
docker load -i release/ticket-frontend.tar
```

Expected: 镜像导入成功。

---

### Task 14: 离线部署验证

**Files:**
- Test: 手动验证

- [ ] **Step 1: 清理本地镜像和容器**

Run:
```bash
docker compose down
docker rmi ticket-backend:latest ticket-frontend:latest
```

- [ ] **Step 2: 使用 release 包离线导入镜像**

Run:
```bash
cd release
docker load -i ticket-backend.tar
docker load -i ticket-frontend.tar
```

Expected: 镜像导入成功。

- [ ] **Step 3: 离线启动**

Run:
```bash
cd release
docker compose up -d
```

Expected: 服务正常启动，访问 `http://localhost` 可进入系统。

- [ ] **Step 4: 停止并返回项目根目录**

Run:
```bash
cd release
docker compose down
cd ..
```

---

## Self-Review Checklist

- [ ] Spec coverage: 四种启动方式、构建脚本、发布包、DEPLOY.md、OFFLINE_DEPLOY.md 均有对应任务。
- [ ] Placeholder scan: 无 TBD/TODO/"add appropriate" 等模糊描述。
- [ ] Type consistency: 镜像名 `ticket-backend:latest` / `ticket-frontend:latest`、发布目录 `release/`、版本号 `$VERSION` 在全文中保持一致。
