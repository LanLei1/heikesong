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

# 复制部署文件，并生成离线版 docker-compose.yml（移除 build 字段）
Copy-Item docker-compose.yml $ReleaseDir/
(Get-Content "$ReleaseDir/docker-compose.yml") | Where-Object { $_ -notmatch '^\s+build: ' } | Set-Content "$ReleaseDir/docker-compose.yml"
Copy-Item .env.example $ReleaseDir/
if (Test-Path DEPLOY.md) { Copy-Item DEPLOY.md $ReleaseDir/ }
if (Test-Path README.md) { Copy-Item README.md $ReleaseDir/ }
$Version | Out-File -FilePath "$ReleaseDir/VERSION" -Encoding utf8

Write-Host "=== Release package created at $ReleaseDir ==="
Get-ChildItem $ReleaseDir
