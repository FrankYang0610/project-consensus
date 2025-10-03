# Preprod 部署指南（Cloudflare Tunnel + Zero Trust）

本指南适用于 `preprod` 分支，目标是：隐藏源站 IP，通过 Cloudflare Zero Trust 对前后端加访问限制，并以稳定的进程方式运行后端（Gunicorn + WhiteNoise）和前端（Next.js）。

- 后端（Django + DRF）：监听 `127.0.0.1:8000`
- 前端（Next.js）：监听 `127.0.0.1:3000`
- 数据库（PostgreSQL 17）：`docker-compose.yml`
- Cloudflare Tunnel：
  - `preprod-app.polyu.life` → `http://127.0.0.1:3000`
  - `preprod-api.polyu.life` → `http://127.0.0.1:8000`
- Zero Trust Access：对 `preprod-app` 与 `preprod-api` 均开启访问控制

---

## 1. 代码与依赖变更（已在分支内完成）

- `config/settings.py`：
  - 静态文件：`STATIC_URL='/static/'`、`STATIC_ROOT=BASE_DIR/'staticfiles'`
  - WhiteNoise：添加 `whitenoise.middleware.WhiteNoiseMiddleware` 并使用 `CompressedManifestStaticFilesStorage`
  - 代理头：`SECURE_PROXY_SSL_HEADER=('HTTP_X_FORWARDED_PROTO','https')`、`USE_X_FORWARDED_HOST=True`
- 依赖：`requirements.in` 增加 `gunicorn==21.2.0`、`whitenoise==6.8.2`，并写入 `requirements.txt`
- 迁移：`accounts/migrations/0003_create_preprod_admins.py`（创建两个预发布管理员账号，强密码从环境变量读取；未提供时随机生成并打印到迁移输出）

---

## 2. 服务器准备

- 系统：Ubuntu 22.04（或其他 Linux/macOS）
- 依赖：
  - Python 3.13.x（建议虚拟环境）
  - Node.js 20+（用于 Next.js 构建与运行）
  - Docker（运行 PostgreSQL 17）
  - cloudflared（Cloudflare Tunnel 客户端）

目录约定（可按需修改）：

- 后端路径：`/opt/project/project-consensus-backend`
- 前端路径：`/opt/project/project-consensus-frontend`

---

## 3. 克隆与安装

```bash
# 以 root 或有 sudo 的用户执行
mkdir -p /opt/project && cd /opt/project
# git clone <repo-url>
# cd project-consensus
# 切换到 preprod 分支
# git checkout preprod

# 后端
cd /opt/project/project-consensus-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 前端
cd /opt/project/project-consensus-frontend
npm ci
```

---

## 4. 数据库（PostgreSQL 17 via Docker Compose）

```bash
cd /opt/project/project-consensus-backend
docker compose up -d
docker compose ps   # 确认 db healthy
```

如需修改宿主端口，请同步更新 `.env` 的 `DATABASE_URL`。

---

## 5. 配置环境变量（后端 .env）

创建 `/opt/project/project-consensus-backend/.env`：

```
DEBUG=False
SECRET_KEY=<强随机>
ALLOWED_HOSTS=preprod-api.polyu.life,127.0.0.1,localhost
LANGUAGE_CODE=zh-hans
TIME_ZONE=Asia/Shanghai

# CORS/CSRF（前端和后端域名都用 https 全写）
CORS_ALLOWED_ORIGINS=https://preprod-app.polyu.life
CSRF_TRUSTED_ORIGINS=https://preprod-app.polyu.life,https://preprod-api.polyu.life

# 数据库：对应 docker-compose 的 Postgres 17
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/appdb

# 可选：预发布管理员账号（迁移时使用；不提供则随机密码并打印到迁移输出）
PREPROD_ADMIN1_USERNAME=admin1
PREPROD_ADMIN1_EMAIL=admin1@polyu.life
PREPROD_ADMIN1_PASSWORD=<强密码-可选>
PREPROD_ADMIN1_DISPLAY_NAME=Preprod Admin 1

PREPROD_ADMIN2_USERNAME=admin2
PREPROD_ADMIN2_EMAIL=admin2@polyu.life
PREPROD_ADMIN2_PASSWORD=<强密码-可选>
PREPROD_ADMIN2_DISPLAY_NAME=Preprod Admin 2
```

> 注意：如果提供 `PREPROD_ADMIN*_PASSWORD`，迁移不会回显密码；若不提供，将在迁移输出中打印随机生成的密码（仅用于预发布环境）。

---

## 6. 初始化数据库与静态文件

```bash
cd /opt/project/project-consensus-backend
source .venv/bin/activate
python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py check
```

- `migrate` 将执行 `0003_create_preprod_admins`，创建两个管理员；注意控制台输出的随机密码（若未在 .env 中显式提供）。

---

## 7. 后端进程（Gunicorn + systemd）

创建 `/etc/systemd/system/project-consensus-backend.service`：

```
[Unit]
Description=Project Consensus Backend (Django + Gunicorn)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/project/project-consensus-backend
EnvironmentFile=/opt/project/project-consensus-backend/.env
ExecStart=/opt/project/project-consensus-backend/.venv/bin/gunicorn config.wsgi:application \
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

---

## 8. 前端构建与运行（Next.js + systemd）

1. 设置前端环境变量文件 `/etc/project-consensus-frontend.env`：

```
NEXT_PUBLIC_API_BASE_URL=https://preprod-api.polyu.life
```

2. 构建与启动：

```bash
cd /opt/project/project-consensus-frontend
npm run build
```

创建 `/etc/systemd/system/project-consensus-frontend.service`：

```
[Unit]
Description=Project Consensus Frontend (Next.js)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/project/project-consensus-frontend
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
cloudflared tunnel create preprod-tunnel
```

2. 绑定 DNS：

```bash
cloudflared tunnel route dns preprod-tunnel preprod-app.polyu.life
cloudflared tunnel route dns preprod-tunnel preprod-api.polyu.life
```

3. 配置 `/etc/cloudflared/config.yml`：

```
tunnel: <tunnel-uuid>
credentials-file: /etc/cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: preprod-app.polyu.life
    service: http://127.0.0.1:3000
  - hostname: preprod-api.polyu.life
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
  - 应用 A：`preprod-app.polyu.life`
  - 应用 B：`preprod-api.polyu.life`
- 策略（Policies）：
  - Allow：仅允许你的测试账号（按 Email/GitHub/Google 身份源筛选）
  - 可设置 Session 时长（例如 8 小时）

> 通过 Access 登录后，浏览器才能访问 app/api；Preflight 与实际请求都会先过 Access。

---

## 11. 联调与验证

- 隧道连通：
  - `curl -I https://preprod-app.polyu.life`
  - `curl -I https://preprod-api.polyu.life`
  - 首次应跳转到 Access；登录后返回 200
- 健康检查：`https://preprod-api.polyu.life/api/health/` → `{"status":"ok"}`
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

# 重启服务
sudo systemctl restart project-consensus-backend
sudo systemctl restart project-consensus-frontend

# 数据库容器
cd /opt/project/project-consensus-backend && docker compose ps
```

---

## 14. 版本更新流程（preprod）

```bash
# 在仓库中
git checkout preprod
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
```

---

如需我将你真实域名与部署路径替换进上述配置样例，并生成可直接拷贝的 systemd 单元与 cloudflared 配置，请告知域名与服务器路径。
