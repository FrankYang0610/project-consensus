# Beta 部署指南（Cloudflare Tunnel + Zero Trust）

本指南适用于 `beta` 分支，目标是：隐藏源站 IP，通过 Cloudflare Zero Trust 对前后端加访问限制，并以稳定的进程方式运行后端（Uvicorn + WhiteNoise）和前端（Next.js）。

- 后端（Django + DRF）：监听 `127.0.0.1:8000`
- 前端（Next.js）：监听 `127.0.0.1:3000`
- 数据库（PostgreSQL 17）：`docker-compose.yml`
- Cloudflare Tunnel：
  - `beta-app.polyu.life` → `http://127.0.0.1:3000`
  - `beta-api.polyu.life` → `http://127.0.0.1:8000`
- Zero Trust Access：对 `beta-app` 与 `beta-api` 均开启访问控制

---

## 1. 代码与依赖变更（已在分支内完成）

- `config/settings.py`：
  - 静态文件：`STATIC_URL='/static/'`、`STATIC_ROOT=BASE_DIR/'staticfiles'`
  - WhiteNoise：添加 `whitenoise.middleware.WhiteNoiseMiddleware` 并使用 `CompressedManifestStaticFilesStorage`
  - 代理头：`SECURE_PROXY_SSL_HEADER=('HTTP_X_FORWARDED_PROTO','https')`、`USE_X_FORWARDED_HOST=True`
- 依赖：`requirements.in` 增加 `uvicorn[standard]==0.38.0`、`whitenoise==6.8.2`，并写入 `requirements.txt`
- 管理员账号：请在部署后使用 `python manage.py createsuperuser` 创建；如需演示账号，可临时设置 `ENABLE_DEMO_USER=true` 后再执行迁移（生产建议关闭）

---

## 2. 服务器准备

- 系统：Ubuntu 22.04（或其他 Linux/macOS）
- 依赖：
  - Python 3.13.x（使用 Conda 环境 py313）
  - Conda/Miniconda/Mamba（用于 Python 环境管理）
  - Node.js 20+（用于 Next.js 构建与运行）
  - Docker（运行 PostgreSQL 17）
  - cloudflared（Cloudflare Tunnel 客户端）

目录约定（可按需修改）：

- 后端路径：`project/project-consensus/project-consensus-backend`
- 前端路径：`project/project-consensus/project-consensus-frontend`

---

## 3. 克隆与安装

```bash
# 以 root 或有 sudo 的用户执行
mkdir -p project && cd project
# git clone <repo-url>
# cd project-consensus
# 切换到 beta 分支
# git checkout beta

# 后端
cd project/project-consensus/project-consensus-backend
conda create -n py313 python=3.13 -y   # 若已存在可跳过
conda activate py313
pip-compile -o requirements.txt requirements.in
pip install -r requirements.txt

# 前端
# 首先需要安装nvm 然后
nvm install --lts
nvm use --lts
cd project/project-consensus/project-consensus-frontend
npm ci
```

---

## 4. 数据库（PostgreSQL 17 via Docker Compose）

```bash
cd project/project-consensus/project-consensus-backend
docker compose up -d
docker compose ps   # 确认 db/redis healthy
```

如需修改宿主端口，请同步更新 `.env` 的 `DATABASE_URL`。

---

## 5. 配置环境变量（后端 .env）

创建 `project/project-consensus/project-consensus-backend/.env`：

```
# Django settings
DEBUG=False
SECRET_KEY=change-me-in-production
ALLOWED_HOSTS=beta-api.polyu.life,127.0.0.1,localhost
LANGUAGE_CODE=zh-hans
TIME_ZONE=Asia/Shanghai

# CORS / CSRF (adjust as needed)
CORS_ALLOWED_ORIGINS=https://beta-app.polyu.life
CSRF_TRUSTED_ORIGINS=https://beta-app.polyu.life,https://beta-api.polyu.life
# Cross-site cookies between app/api subdomains require SameSite=None and HTTPS
SESSION_COOKIE_SAMESITE=None
CSRF_COOKIE_SAMESITE=None

# Postgres Connection (Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/appdb

# Cloudflare R2 Configuration
# TODO: Replace with actual values from Cloudflare R2 Dashboard
# ! Use custom domain: Settings → Custom Domains → Add Domain
# CNAME: images.yourdomain.com → xxx.r2.cloudflarestorage.com
# ! Use public domain: pub-xxxxx.r2.dev
R2_ACCOUNT_ID=your_r2_account_id
R2_BUCKET_NAME=your_bucket_name
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_PUBLIC_DOMAIN=your_public_domain.r2.dev

# Image Upload Settings
MAX_IMAGE_SIZE_MB=5
MAX_IMAGE_PIXELS=50000000
ALLOWED_IMAGE_TYPES=jpg,jpeg,png,gif,webp
ALLOWED_IMAGE_HOSTS=image.polyu.life

# ==================== Email Service Configuration (Resend) ====================
# Resend API Configuration for sending transactional emails
# Get your API key from: https://resend.com/api-keys
# Domain verification required at: https://resend.com/domains

# Enable/disable email sending (set to false for development to use console logs)
EMAIL_ENABLED=false

# Resend API Key (required when EMAIL_ENABLED=true)
# Example: re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_API_KEY=

# Email sender address (must be verified domain in Resend)
# Format: "Display Name <email@domain.com>"
EMAIL_FROM_ADDRESS=PolyU Life <admin@polyu.life>

# Reply-to address for user responses
EMAIL_REPLY_TO=noreply@polyu.life

# ==================== Email Verification Settings ====================
# Verification code time-to-live (seconds)
AUTH_VERIFICATION_CODE_TTL_SECONDS=900

# Minimum interval between verification code requests per email (seconds)
AUTH_VERIFICATION_REQUEST_INTERVAL_SECONDS=90

# Maximum verification code attempts before requiring a new code
AUTH_VERIFICATION_MAX_ATTEMPTS=5

# ==================== Celery Configuration (Async Task Queue) ====================
# Enable asynchronous email sending via Celery (recommended for production)
# Set to true to send emails in background, false for synchronous sending
EMAIL_USE_CELERY=false

# Redis URL for Celery broker (required when EMAIL_USE_CELERY=true)
# Format: redis://[username:password@]host:port/database
# ⚠️ Important: Must match the password in docker-compose.yml (--requirepass)
CELERY_BROKER_URL=redis://:redis_secure_password@localhost:6379/0

# Celery result backend (optional)
# Use 'rpc://' for temporary results or Redis URL for persistent results
# Example: redis://localhost:6379/1
CELERY_RESULT_BACKEND=rpc://

# ==================== Password Reset Configuration ====================
# Frontend base URL for generating password reset links
# This should be your frontend application URL (without trailing slash)
FRONTEND_BASE_URL=http://localhost:3000

# Password reset token timeout (seconds)
# Default: 3600 (1 hour)
PASSWORD_RESET_TIMEOUT=3600

# Minimum interval between password reset requests per email (seconds)
PASSWORD_RESET_REQUEST_INTERVAL_SECONDS=300

```

> 管理员创建：迁移完之后使用 `python manage.py createsuperuser`。

---

## 6. 初始化数据库与静态文件

```bash
cd project/project-consensus/project-consensus-backend
conda activate py313
python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py check
```

- - 建议在迁移后运行：`python manage.py createsuperuser` 创建管理员账号。

---

## 7. 后端进程（uvicorn + systemd）

创建 `/etc/systemd/system/project-consensus-backend.service`：

```
[Unit]
Description=Project Consensus Backend (Django + Uvicorn)
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/jimyang/project/project-consensus/project-consensus-backend
EnvironmentFile=/home/jimyang/project/project-consensus/project-consensus-backend/.env
ExecStart=/home/jimyang/miniconda3/condabin/conda run -n py313 --no-capture-output \
  uvicorn config.asgi:application --host 127.0.0.1 --port 8000 \
  --workers 1 --loop uvloop --http httptools
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now project-consensus-backend
sudo systemctl status project-consensus-backend
```

> Conda 路径说明：如果 `conda` 不在 `/usr/bin/conda`，请用 `which conda` 找到实际绝对路径，并替换上方 unit 文件中 `ExecStart` 的 conda 路径（例如 `/home/ubuntu/miniconda3/bin/conda run -n py313 ...`）。

### Celery Worker（systemd）

创建 `/etc/systemd/system/project-consensus-celery.service`：

```
[Unit]
Description=Project Consensus Celery Worker
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/jimyang/project/project-consensus/project-consensus-backend
EnvironmentFile=/home/jimyang/project/project-consensus/project-consensus-backend/.env
ExecStart=/home/jimyang/miniconda3/condabin/conda run -n py313 --no-capture-output celery -A config worker \
  --loglevel=info --concurrency=8 --max-tasks-per-child=1000 --time-limit=300 --soft-time-limit=240
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now project-consensus-celery
sudo systemctl status project-consensus-celery
```

> 注意：确保 Redis 已启动且 `.env` 的 `CELERY_BROKER_URL` 密码与 `docker-compose.yml` 一致（默认 `redis_secure_password`）。

---

## 8. 前端构建与运行（Next.js + systemd）

### 1. 配置前端环境变量

Next.js 会在 **构建时** 和 **运行时** 解析 `NEXT_PUBLIC_*` 变量，请确保二者都能读取到。推荐两种做法（二选一）：

- **方案 A（推荐）**：在项目根创建 `.env.production`

  ```bash
  cd /home/jimyang/project/project-consensus/project-consensus-frontend
  cat > .env.production <<'EOF'
  NEXT_PUBLIC_API_BASE_URL=https://beta-api.polyu.life
  # NEXT_PUBLIC_CKEDITOR_LICENSE_KEY=GPL     # 如有需要
  EOF
  ```

  之后直接执行 `npm run build` 即可，Next.js 会自动加载此文件。

- **方案 B**：继续使用系统级文件 `/etc/project-consensus-frontend.env`

  ```
  NEXT_PUBLIC_API_BASE_URL=https://beta-api.polyu.life
  ```

  在构建前让当前 shell 继承该文件，再执行构建命令，例如：

  ```bash
  set -a
  . /etc/project-consensus-frontend.env
  set +a
  npm run build
  ```

  systemd 服务依然通过 `EnvironmentFile=` 引用该文件，保证运行时变量一致。

### 2. 构建项目

```bash
cd /home/jimyang/project/project-consensus/project-consensus-frontend
npm run build        # 采用方案 A 时可直接执行
# 采用方案 B 时请确保已按上方方式导入变量后再执行
```

创建 `/etc/systemd/system/project-consensus-frontend.service`：

```
[Unit]  
Description=Project Consensus Frontend (Next.js)
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/jimyang/project/project-consensus/project-consensus-frontend
EnvironmentFile=/etc/project-consensus-frontend.env
ExecStart=/home/jimyang/.nvm/versions/node/v22.20.0/bin/node node_modules/.bin/next start -p 3000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now project-consensus-frontend
sudo systemctl status project-consensus-frontend
```

---

## 9. Cloudflare Tunnel

1. 登录与创建隧道：

```bash
cloudflared tunnel login
cloudflared tunnel create beta-tunnel
```

2. 绑定 DNS：

```bash
cloudflared tunnel route dns beta-tunnel beta-app.polyu.life
cloudflared tunnel route dns beta-tunnel beta-api.polyu.life
```

3. 配置 `/etc/cloudflared/config.yml`：

```
tunnel: <tunnel-uuid>
credentials-file: /etc/cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: beta-app.polyu.life
    service: http://127.0.0.1:3000
  - hostname: beta-api.polyu.life
    service: http://127.0.0.1:8000
  - service: http_status:404
```

4. 以服务方式运行：

```bash
sudo cloudflared service install
# 或
# sudo systemctl enable --now cloudflared
```

---

## 10. Cloudflare Zero Trust Access（访问限制）

- Zero Trust → Access → Applications → Add application → Self-hosted：
  - 应用 A：`beta-app.polyu.life`
  - 应用 B：`beta-api.polyu.life`
- 策略（Policies）：
  - Allow：仅允许你的测试账号（按 Email/GitHub/Google 身份源筛选）
  - 可设置 Session 时长（例如 8 小时）

> 通过 Access 登录后，浏览器才能访问 app/api；Preflight 与实际请求都会先过 Access。

---

## 11. 联调与验证

- 隧道连通：
  - `curl -I https://beta-app.polyu.life`
  - `curl -I https://beta-api.polyu.life`
  - 首次应跳转到 Access；登录后返回 200
- 健康检查：`https://beta-api.polyu.life/api/health/` → `{"status":"ok"}`
- 通知 SSE：`/api/notifications/stream/` 需保持长连接与禁用代理缓冲；使用 Redis 作为消息总线，支持 Last-Event-ID 回放。使用会话 Cookie认证。
- 静态文件：确认 `/static/...` 可加载（已执行 `collectstatic`，WhiteNoise 生效）
- CORS/CSRF：
  - 前端请求应携带 Cookie（`credentials: 'include'`）
  - 首次写操作前将获取 `csrftoken`（`/api/accounts/csrf/`）
  - 若 403，检查 `.env` 的 `CSRF_TRUSTED_ORIGINS` 是否包含 app/api 的 https 域
- Host 校验：若 400 Bad Request，检查 `ALLOWED_HOSTS`

---

## 12. 常见问题

- 静态文件 404：检查 `STATIC_URL='/static/'`、`STATIC_ROOT`、`collectstatic`、中间件顺序（Security → WhiteNoise → Session）
- HTTPS 判定不生效：确认 `SECURE_PROXY_SSL_HEADER` 设置，cloudflared 默认会传递 `X-Forwarded-Proto: https`
- Cookie 不被发送：尝试改为 `SESSION_COOKIE_SAMESITE='None'` 与 `CSRF_COOKIE_SAMESITE='None'`，并确保全程 HTTPS
- 被 Access 阻挡：先在同一浏览器完成 Access 登录；检查策略是否允许当前账号/身份源

### 通知（Redis + SSE）配置

后端环境变量（`.env`）：

```
# Redis（通知运行时，未设置时回退到 CELERY_BROKER_URL）
NOTIFICATIONS_REDIS_URL=redis://:redis_secure_password@localhost:6379/1
NOTIFICATIONS_REDIS_CHANNEL_PREFIX=notifications:chan:
NOTIFICATIONS_REDIS_SEQ_PREFIX=notifications:seq:
NOTIFICATIONS_REDIS_BACKLOG_PREFIX=notifications:backlog:
NOTIFICATIONS_REDIS_BACKLOG_SIZE=200
```

客户端使用流程：

1) 默认（推荐）——会话 Cookie（已登录）：

```
GET /api/notifications/stream/
Header: Accept: text/event-stream
Credentials: include  # 浏览器端需 withCredentials: true
```

2) 断线重连时带上最近收到的事件 ID 实现回放：

```
GET /api/notifications/stream/?lastEventId=123
# 或 Header: Last-Event-ID: 123
```

3) 认证方式：统一使用会话 Cookie。

---

## 13. 运维命令速查

```bash
# 后端日志
journalctl -u project-consensus-backend -f

# 前端日志
journalctl -u project-consensus-frontend -f

# Celery 日志
journalctl -u project-consensus-celery -f

# 重启服务
sudo systemctl restart project-consensus-backend
sudo systemctl restart project-consensus-frontend
sudo systemctl restart project-consensus-celery

# 数据库容器
cd /opt/project/project-consensus-backend && docker compose ps
```

---

## 14. 版本更新流程（beta）

```bash
# 在仓库中
git checkout beta
git pull

# 后端
cd /opt/project/project-consensus/project-consensus-backend
conda activate py313
pip install -r requirements.txt
python manage.py migrate --noinput
python manage.py collectstatic --noinput
sudo systemctl restart project-consensus-backend

# 前端
cd /opt/project/project-consensus/project-consensus-frontend
npm ci
npm run build
sudo systemctl restart project-consensus-frontend

# Celery
sudo systemctl restart project-consensus-celery
```

---
