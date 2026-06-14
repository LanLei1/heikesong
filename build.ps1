param(
    [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"

# 获取脚本所在目录，确保无论从哪运行都能正确找到文件
$ProjectRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Get-Location }
$ReleaseDir = Join-Path $ProjectRoot "release"
$BackendImage = "ticket-backend:latest"
$FrontendImage = "ticket-frontend:latest"

Write-Host "=== Ticket System Build Script ==="
Write-Host "Version: $Version"
Write-Host "Project root: $ProjectRoot"

# 检查 Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Error: docker is not installed."
    exit 1
}

# 清理旧发布包
if (Test-Path $ReleaseDir) {
    Write-Host "Cleaning old release directory: $ReleaseDir"
    Remove-Item -Recurse -Force $ReleaseDir
}
New-Item -ItemType Directory -Path $ReleaseDir | Out-Null

# 构建后端镜像
Write-Host "=== Building backend image ==="
docker build -t $BackendImage (Join-Path $ProjectRoot "backend")

# 构建前端镜像
Write-Host "=== Building frontend image ==="
docker build -t $FrontendImage (Join-Path $ProjectRoot "frontend")

# 导出镜像
Write-Host "=== Saving images ==="
docker save $BackendImage -o (Join-Path $ReleaseDir "ticket-backend.tar")
docker save $FrontendImage -o (Join-Path $ReleaseDir "ticket-frontend.tar")

# 复制部署文件，并生成离线版 docker-compose.yml（移除 build 字段）
Write-Host "=== Copying deployment files ==="

$ComposeSource = Join-Path $ProjectRoot "docker-compose.yml"
$ComposeTarget = Join-Path $ReleaseDir "docker-compose.yml"

Copy-Item $ComposeSource $ComposeTarget

if (-not (Test-Path $ComposeTarget)) {
    Write-Error "Failed to copy docker-compose.yml to release directory"
    exit 1
}

$ComposeContent = Get-Content $ComposeTarget | Where-Object { $_ -notmatch '^\s+build: ' }
$ComposeContent | Set-Content $ComposeTarget -Encoding utf8

Copy-Item (Join-Path $ProjectRoot ".env.example") $ReleaseDir/

$DeployMd = Join-Path $ProjectRoot "DEPLOY.md"
$ReadmeMd = Join-Path $ProjectRoot "README.md"

if (Test-Path $DeployMd) { Copy-Item $DeployMd $ReleaseDir/ }
if (Test-Path $ReadmeMd) { Copy-Item $ReadmeMd $ReleaseDir/ }

$Version | Out-File -FilePath (Join-Path $ReleaseDir "VERSION") -Encoding utf8

Write-Host "=== Release package created at $ReleaseDir ==="
Get-ChildItem $ReleaseDir
