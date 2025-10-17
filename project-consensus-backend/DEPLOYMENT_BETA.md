# Beta 部署指南（Cloudflare Tunnel + Zero Trust）

本指南适用于 `beta` 分支，目标是：隐藏源站 IP，通过 Cloudflare Zero Trust 对前后端加访问限制，并以稳定的进程方式运行后端（Gunicorn + WhiteNoise）和前端（Next.js）。

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
- 依赖：`requirements.in` 增加 `gunicorn==21.2.0`、`whitenoise==6.8.2`，并写入 `requirements.txt`
- 管理员账号：请在部署后使用 `python manage.py createsuperuser` 创建；如需演示账号，可临时设置 `ENABLE_DEMO_USER=true` 后再执行迁移（生产建议关闭）

---

## 2. 服务器准备

- 系统：Ubuntu 22.04（或其他 Linux/macOS）
- 依赖：
  - Python 3.13.x（建议虚拟环境）
  - Node.js 20+（用于 Next.js 构建与运行）
  - Docker（运行 PostgreSQL 17）
  - cloudflared（Cloudflare Tunnel 客户端）

目录约定（可按需修改）：

- 后端路径：`/project/project-consensus-backend`
- 前端路径：`/project/project-consensus-frontend`

---

## 3. 克隆与安装

```bash
# 以 root 或有 sudo 的用户执行
mkdir -p /project && cd /project
# git clone <repo-url>
# cd project-consensus
# 切换到 beta 分支
# git checkout beta

# 后端
cd /project/project-consensus-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 前端
cd /project/project-consensus-frontend
npm ci
```

---

## 4. 数据库（PostgreSQL 17 via Docker Compose）

```bash
cd /project/project-consensus-backend
docker compose up -d
docker compose ps   # 确认 db/redis healthy
```

如需修改宿主端口，请同步更新 `.env` 的 `DATABASE_URL`。

---

## 5. 配置环境变量（后端 .env）

创建 `/project/project-consensus-backend/.env`：

```
DEBUG=False
SECRET_KEY=<强随机>
ALLOWED_HOSTS=beta-api.polyu.life,127.0.0.1,localhost
LANGUAGE_CODE=zh-hans
TIME_ZONE=Asia/Shanghai

# CORS/CSRF（前端和后端域名都用 https 全写）
CORS_ALLOWED_ORIGINS=https://beta-app.polyu.life
CSRF_TRUSTED_ORIGINS=https://beta-app.polyu.life,https://beta-api.polyu.life

# 数据库：对应 docker-compose 的 Postgres 17
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/appdb

# 邮件与 Celery（推荐在 beta 启用）
EMAIL_ENABLED=true
EMAIL_USE_CELERY=true
RESEND_API_KEY=<你的 Resend API Key>
EMAIL_FROM_ADDRESS="PolyU Life <noreply@polyu.life>"
EMAIL_REPLY_TO=noreply@polyu.life

# Celery Broker / Result Backend
CELERY_BROKER_URL=redis://:redis_secure_password@127.0.0.1:6379/0
CELERY_RESULT_BACKEND=rpc://

# 跨站/跨域 Cookie（如需与不同站点或第三方上下文集成时）：
# SESSION_COOKIE_SAMESITE=None
# CSRF_COOKIE_SAMESITE=None
```

> 管理员创建：使用 `python manage.py createsuperuser`。

---

## 6. 初始化数据库与静态文件

```bash
cd /project/project-consensus-backend
source .venv/bin/activate
python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py check
```

- - 建议在迁移后运行：`python manage.py createsuperuser` 创建管理员账号。

---

## 7. 后端进程（Gunicorn + systemd）

创建 `/etc/systemd/system/project-consensus-backend.service`：

```
[Unit]
Description=Project Consensus Backend (Django + Gunicorn)
After=network.target

[Service]
Type=simple
WorkingDirectory=/project/project-consensus-backend
EnvironmentFile=/project/project-consensus-backend/.env
ExecStart=/project/project-consensus-backend/.venv/bin/gunicorn config.wsgi:application \
  --bind 127.0.0.1:8000 --workers 3 --timeout 60
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

### Celery Worker（systemd）

创建 `/etc/systemd/system/project-consensus-celery.service`：

```
[Unit]
Description=Project Consensus Celery Worker
After=network.target

[Service]
Type=simple
WorkingDirectory=/project/project-consensus-backend
EnvironmentFile=/project/project-consensus-backend/.env
ExecStart=/project/project-consensus-backend/.venv/bin/celery -A config worker \
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
  cd /project/project-consensus-frontend
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
cd /project/project-consensus-frontend
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
WorkingDirectory=/project/project-consensus-frontend
EnvironmentFile=/etc/project-consensus-frontend.env
ExecStart=/usr/bin/node node_modules/.bin/next start -p 3000
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
cd /opt/project/project-consensus-backend
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate --noinput
python manage.py collectstatic --noinput
sudo systemctl restart project-consensus-backend

# 前端
cd /opt/project/project-consensus-frontend
npm ci
npm run build
sudo systemctl restart project-consensus-frontend

# Celery
sudo systemctl restart project-consensus-celery
```

---
