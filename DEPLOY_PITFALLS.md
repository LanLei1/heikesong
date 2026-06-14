# 部署踩坑记录

本文档记录本项目在 Docker 构建、离线打包、跨平台部署过程中遇到的实际问题及解决方案，供后续参考。

---

## 一、Docker 镜像拉取失败

### 现象

在 Windows 或 Ubuntu 上执行 `docker build` 或 `docker compose up` 时，基础镜像拉取失败：

```text
failed to authorize: failed to fetch anonymous token: ...
connectex: A connection attempt failed ...
```

或：

```text
failed to do request: Head "https://docker.mirrors.ustc.edu.cn/...": dial tcp: lookup ... no such host
```

### 原因

- Docker Hub 在国内访问不稳定
- 配置的镜像加速器本身需要代理（如 DaoCloud 的 `m.daocloud.io` 需要本地代理）
- 服务器 DNS 无法解析镜像加速器域名

### 解决方案

**Windows（Docker Desktop）：**

编辑 `C:\Users\<用户名>\.docker\daemon.json`：

```json
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com"
  ]
}
```

重启 Docker Desktop。

**Linux（Ubuntu/CentOS）：**

```bash
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com"
  ]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### 预防措施

- 首次部署前先 `docker pull python:3.11-slim`、`node:20-alpine`、`nginx:alpine` 测试网络
- 如果服务器完全无网络，不要尝试在服务器上 `docker build`，应使用离线包 `release/`
- 不要配置需要本地代理的镜像加速器到服务器

---

## 二、build 脚本 ≠ 部署脚本

### 现象

在无网络的服务器上直接运行 `./build.sh`，期望完成部署，结果报错拉取基础镜像失败。

### 原因

`build.sh` / `build.ps1` 的作用是：

1. 拉取基础镜像
2. 构建前后端镜像
3. 导出镜像为 tar 包
4. 生成 `release/` 离线发布包

它需要访问 Docker Hub，必须在**能联网的机器**上运行。

### 正确流程

```text
能联网机器：./build.sh → 生成 release/
                     ↓
            复制 release/ 到目标服务器（U盘/scp/rsync）
                     ↓
目标服务器：cd release && docker load -i *.tar && docker compose up -d
```

### 预防措施

- `build.sh` 用于**生成离线包**
- `docker compose up -d` 用于**实际部署**
- 两者不要混用

---

## 三、后端容器无法写入 SQLite 数据库

### 现象

后端容器不断重启，日志显示：

```text
sqlite3.OperationalError: unable to open database file
```

前端登录报 `Request failed with status code 502`。

### 原因

后端 Dockerfile 为了安全使用非 root 用户 `appuser` 运行：

```dockerfile
USER appuser
```

但 `docker-compose.yml` 把宿主机的 `./data` 挂载到容器的 `/data`。在 Linux 上，宿主机 `data/` 目录默认属于当前登录用户，容器内 `appuser` 的 UID 不同，没有写入权限，导致 SQLite 无法创建 `tickets.db`。

### 解决方案

**方案 1：临时放宽目录权限（最快）**

```bash
cd release
chmod -R 777 data
docker compose up -d
```

**方案 2：让后端容器以 root 运行**

修改 `release/docker-compose.yml`：

```yaml
services:
  backend:
    image: ticket-backend:latest
    user: "0:0"
    ...
```

**方案 3：修改后端 Dockerfile 不切换用户**

注释或删除：

```dockerfile
# USER appuser
```

然后重新构建镜像。

### 预防措施

- Linux 服务器部署时，优先执行 `chmod -R 777 data`
- 内网/内部工具场景下，可以取消非 root 用户以简化权限管理
- 文档中明确说明数据目录权限要求

---

## 四、80 端口被占用

### 现象

`docker compose up -d` 时报错：

```text
Bind for 0.0.0.0:80 failed: port is already allocated
```

### 原因

服务器上已有 Nginx、Apache 或其他服务占用了 80 端口。

### 解决方案

修改 `release/docker-compose.yml` 中的端口映射：

```yaml
services:
  frontend:
    image: ticket-frontend:latest
    ports:
      - "8222:80"
```

然后访问 `http://服务器IP:8222`。

### 预防措施

- 不要在服务器上使用 80、443、5000 等常用默认端口
- 内网工具建议使用高位端口，如 8080、8222、9000 等
- 部署前先检查端口占用：

```bash
ss -tlnp | grep 8222
```

---

## 五、离线包 `release/` 目录为空

### 现象

在服务器上 `cd release` 后执行 `docker load -i ticket-backend.tar`，报错：

```text
open ticket-backend.tar: no such file or directory
```

### 原因

`release/` 目录没有从本机传输到服务器，或者传输过程中断。

### 解决方案

在 Windows 本机确认 `release/` 有内容：

```bash
ls C:/Users/lanlei/Desktop/cc_test/release/
```

然后传输到服务器：

```bash
scp -r C:/Users/lanlei/Desktop/cc_test/release id_seq@172.16.0.55:/sdbb/bioinfor/id_seq/test_cc/
```

### 预防措施

- 传输后用 `ls -lh release/` 确认 tar 包大小正常
- 大文件传输建议使用 `rsync` 或压缩后传输

---

## 六、PowerShell build.ps1 路径问题

### 现象

Windows 上运行 `build.ps1` 时报错：

```text
Get-Content : 找不到路径 "C:\...\release\docker-compose.yml"
```

### 原因

原脚本使用相对路径，PowerShell 执行时当前工作目录可能与脚本所在目录不一致。

### 解决方案

新版 `build.ps1` 已修复：

- 使用 `$PSScriptRoot` 自动定位脚本目录
- 使用 `Join-Path` 拼接路径
- 增加文件存在性检查

### 预防措施

- Windows 部署脚本尽量使用绝对路径或 `$PSScriptRoot`
- 跨平台脚本避免硬编码路径分隔符

---

## 七、GitHub 推送覆盖远程历史

### 现象

首次 `git push` 后发现远程仓库多了一个 `heikesong` submodule。

### 原因

远程仓库 `LanLei1/heikesong` 原本不是空的，直接 push 不会自动覆盖。之前可能把该仓库作为 submodule 添加到了本地。

### 解决方案

强制推送覆盖远程所有分支：

```bash
git push origin master --force
git push origin master:main --force
```

### 预防措施

- 推送前先 `git ls-remote` 检查远程是否为空
- 如果要覆盖历史，确保团队其他成员知晓
- 重要仓库不要频繁 force push

---

## 八、JWT_SECRET_KEY 未修改

### 现象

使用默认配置部署后，系统可以运行但存在安全隐患。

### 原因

`.env.example` 中 `JWT_SECRET_KEY=change-me-in-production` 是默认值，如果不修改，任何人都可以用默认密钥伪造 token。

### 解决方案

部署前生成随机密钥：

```bash
openssl rand -hex 32
```

写入 `.env`：

```text
JWT_SECRET_KEY=你的随机字符串
```

### 预防措施

- 生产环境必须修改 JWT_SECRET_KEY
- `.env` 文件已在 `.gitignore` 中，不会上传到 GitHub

---

## 九、docker-compose 命令混用

### 现象

文档中有时写 `docker-compose`，有时写 `docker compose`，在新系统上可能不识别。

### 原因

- `docker-compose` 是 Docker Compose v1 的独立命令
- `docker compose` 是 Docker Compose v2 的插件命令
- 新版 Docker 可能只安装了 `docker compose`

### 解决方案

统一使用新版命令：

```bash
docker compose up -d
docker compose down
docker compose logs -f
```

### 预防措施

- 所有文档和脚本统一使用 `docker compose`（空格，无横杠）
- 避免在文档中混用两种写法

---

## 十、标准部署检查清单

每次在新机器部署前，按以下顺序检查：

```text
□ Docker 和 Docker Compose 已安装
□ 网络能拉取基础镜像，或已准备好 release/ 离线包
□ 端口不冲突（避免 80/443/5000）
□ data/ 目录存在且有写入权限
□ .env 中 JWT_SECRET_KEY 已修改
□ release/ 目录文件完整（tar 包、docker-compose.yml、.env.example）
□ 部署后检查 docker ps 和 docker logs
```

---

## 附录：推荐端口配置

| 服务 | 默认端口 | 推荐内网端口 | 说明 |
|------|---------|-------------|------|
| 前端 Nginx | 80 | 8222 或 8080 | 避免与系统 Nginx 冲突 |
| 后端 Flask | 5000 | 5000 或 5001 | 如冲突则修改 |

修改 `release/docker-compose.yml`：

```yaml
services:
  backend:
    image: ticket-backend:latest
    ports:
      - "5000:5000"
  frontend:
    image: ticket-frontend:latest
    ports:
      - "8222:80"
```

访问地址：`http://服务器IP:8222`
