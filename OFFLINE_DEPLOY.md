# 离线部署指南

本文档介绍如何在无互联网连接的环境中部署工单管理系统。

---

## 适用场景

- 无外网环境
- 医院内网环境
- 客户内网环境
- 需要物理隔离的生产环境

---

## 前提条件

目标机器必须已经安装：

- Docker 20.10+
- Docker Compose 2.20+

如果目标机器尚未安装 Docker，请提前在有网络的环境中下载 Docker 安装包并复制到目标机器安装。

---

## 离线安装步骤

### 1. 获取离线发布包

在有网络的环境中执行构建脚本：

```bash
# Linux / macOS / WSL / Git Bash
./build.sh 1.0.0
```

或在 Windows PowerShell 中执行：

```powershell
.\build.ps1 -Version 1.0.0
```

构建完成后会生成 `release/` 目录，内容如下：

```
release/
├── ticket-backend.tar      # 后端镜像包
├── ticket-frontend.tar     # 前端镜像包
├── docker-compose.yml      # 服务编排文件
├── .env.example            # 环境变量模板
├── DEPLOY.md               # 完整部署文档
├── README.md               # 项目简介
└── VERSION                 # 版本号
```

### 2. 复制到目标环境

将 `release/` 目录整体复制到目标机器，例如使用 U 盘、内网文件服务器或安全拷贝工具。

建议复制到目标机器的 `/opt/ticket-system/` 目录：

```bash
mkdir -p /opt/ticket-system
cp -r release/* /opt/ticket-system/
cd /opt/ticket-system
```

---

## 镜像导入步骤

在目标机器上进入发布包目录：

```bash
cd /opt/ticket-system
```

导入镜像：

```bash
docker load -i ticket-backend.tar
docker load -i ticket-frontend.tar
```

导入成功后，查看镜像：

```bash
docker images
```

应能看到：

```
REPOSITORY        TAG       IMAGE ID       CREATED
ticket-backend    latest    xxxxxxxxxxxx   xx minutes ago
ticket-frontend   latest    xxxxxxxxxxxx   xx minutes ago
```

---

## 启动步骤

### 1. 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env` 文件，修改 `JWT_SECRET_KEY` 为强密码：

```text
JWT_SECRET_KEY=your-strong-secret-key-here
DB_PATH=/data/tickets.db
```

### 2. 创建数据目录

```bash
mkdir -p data
```

### 3. 启动服务

```bash
docker compose up -d
```

### 4. 验证服务状态

```bash
docker compose ps
docker compose logs -f
```

### 5. 访问系统

打开浏览器访问：

```
http://localhost
```

默认账号：

- 用户名：`admin`
- 密码：`admin123`

---

## 升级步骤

### 1. 备份当前数据

```bash
docker compose down
tar -czvf ticket-backup-before-upgrade-$(date +%Y%m%d).tar.gz data/
```

### 2. 导入新版本镜像

```bash
docker load -i ticket-backend-new.tar
docker load -i ticket-frontend-new.tar
```

### 3. 更新镜像标签

```bash
docker tag ticket-backend:new-version ticket-backend:latest
docker tag ticket-frontend:new-version ticket-frontend:latest
```

### 4. 重新启动

```bash
docker compose up -d
```

---

## 回滚步骤

如果升级后出现问题，可以回滚到旧版本。

### 1. 停止当前服务

```bash
docker compose down
```

### 2. 恢复旧版本镜像

如果旧版本镜像仍然保留在本地：

```bash
docker tag ticket-backend:old-version ticket-backend:latest
docker tag ticket-frontend:old-version ticket-frontend:latest
```

如果旧版本镜像已删除，重新加载旧版本的 tar 包：

```bash
docker load -i ticket-backend-old.tar
docker load -i ticket-frontend-old.tar
```

### 3. 恢复数据（如需要）

```bash
rm -rf data
tar -xzvf ticket-backup-before-upgrade-YYYYMMDD.tar.gz
```

### 4. 重新启动

```bash
docker compose up -d
```

---

## 离线环境常见问题

### 无法拉取基础镜像

离线环境不应尝试拉取镜像。请确保 `docker-compose.yml` 中使用了本地导入的镜像：

```yaml
services:
  backend:
    image: ticket-backend:latest
  frontend:
    image: ticket-frontend:latest
```

如果 `docker compose up -d` 仍然尝试拉取镜像，可以禁用 pull：

```bash
docker compose up -d --no-build --pull never
```

### 数据目录权限不足

```bash
chmod -R 777 data
```

### 端口冲突

修改 `docker-compose.yml` 中的端口映射，例如将 `80:80` 改为 `8080:80`。

### JWT 密钥未修改

生产环境必须修改 `.env` 中的 `JWT_SECRET_KEY`，不要使用默认值。

---

## 发布包内容说明

| 文件 | 说明 |
|------|------|
| `ticket-backend.tar` | 后端 Docker 镜像离线包 |
| `ticket-frontend.tar` | 前端 Docker 镜像离线包 |
| `docker-compose.yml` | 服务编排文件，无需网络即可启动 |
| `.env.example` | 环境变量模板 |
| `DEPLOY.md` | 完整部署文档 |
| `README.md` | 项目简介 |
| `VERSION` | 当前版本号 |
