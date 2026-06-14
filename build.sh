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

# 复制部署文件，并生成离线版 docker-compose.yml（移除 build 字段）
cp docker-compose.yml "$RELEASE_DIR/"
sed -i '/^    build: /d' "$RELEASE_DIR/docker-compose.yml"
cp .env.example "$RELEASE_DIR/"
cp DEPLOY.md "$RELEASE_DIR/" 2>/dev/null || true
cp README.md "$RELEASE_DIR/" 2>/dev/null || true
echo "$VERSION" > "$RELEASE_DIR/VERSION"

echo "=== Release package created at $RELEASE_DIR ==="
ls -lh "$RELEASE_DIR"
