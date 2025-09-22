# 项目简介

Django + DRF + PostgreSQL 17 的后端模板。

- Python：3.13.7
- 依赖已锁定：见 `requirements.txt`
- DB：通过 Docker 运行 PostgreSQL 17（保证环境一致）
- 配置：使用 `.env`（不入库）
- CI：GitHub Actions（每次 push/PR 自动验证能否安装依赖并成功迁移数据库）

> 说明：本 README 位于 `project-consensus-backend/` 根目录，以下命令默认在该目录下执行。

---

## 快速开始（macOS）

适用于 macOS。首次使用请按顺序执行。

```bash
# 1) 安装 Docker Desktop（二选一）
#   A) 用 Homebrew（推荐）：
brew install --cask docker
#   安装后从“应用程序”里“Docker.app”首次手动打开，等待右上角小鲸鱼变成就绪状态
#   B) 或到 Docker 官网下载 DMG 安装，再手动打开 Docker.app

# 2) 克隆仓库（如果你还未克隆），并进入后端目录
# git clone <repo-url> && cd <repo-folder>/project-consensus-backend

# 3) 安装/激活 Python 3.13.7 虚拟环境
#！注意，如果使用anaconda/conda且默认激活了，需要先进行conda deactivate

python3 -V                       # 确认是 3.13.7（或 3.13.x）
python3 -m venv .venv
source .venv/bin/activate
python -V && pip -V


# 4) 安装依赖（已锁定）
pip install -r requirements.txt

# 5) 配置环境变量（推荐从示例复制）
cp .env.example .env
# 打开 .env，至少确认：
#   DEBUG=True
#   SECRET_KEY=任意非空字符串（生产请改为强随机）
#   ALLOWED_HOSTS=127.0.0.1,localhost
#   CORS_ALLOWED_ORIGINS=http://localhost:3000（如有前端）
#   CSRF_TRUSTED_ORIGINS=http://localhost:8000（如使用 Cookie/会话）
#   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/appdb

# 6) 启动 PostgreSQL 17（确保 Docker Desktop 已经打开并就绪）
docker compose up -d
docker compose ps    # db 应显示 "healthy"

# 7) 初始化数据库并启动服务
python manage.py migrate
python manage.py runserver

# 8) 验证
# 浏览器打开：http://127.0.0.1:8000/api/health/ ，应返回：
# {"status":"ok"}
```

---

## 配置说明

- `.env`（本地）：
  - `DEBUG=True`（开发）
  - `SECRET_KEY=任意非空字符串`（生产需改为强随机，并通过环境变量注入）
  - `ALLOWED_HOSTS=127.0.0.1,localhost`
  - `CORS_ALLOWED_ORIGINS=http://localhost:3000`（如有前端）
  - `CSRF_TRUSTED_ORIGINS=http://localhost:8000`（如使用 Cookie/会话）
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/appdb`
- `docker-compose.yml`：使用 `postgres:17`，端口映射 `5432:5432`，用户名密码均为 `postgres`，数据库名 `appdb`。

  - 若你本机 5432 被占用，可改成：

    ```yaml
    ports:
      - "55432:5432"
    ```

    同时把 `.env` 的 `DATABASE_URL` 改为：

    ```
    postgresql://postgres:postgres@localhost:55432/appdb
    ```

---

## 常用命令

- Docker / 数据库

```bash
docker compose up -d               # 启动 DB
docker compose stop                # 停止 DB
docker compose logs -f db          # 查看 DB 日志
docker exec -it dj_db17 psql -U postgres -d appdb   # 进入 psql
# psql 内常用：
#   \dt                      -- 列出表
#   select count(*) from django_migrations;
#   \q                      -- 退出
```

- Django

```bash
python manage.py makemigrations     # 根据模型变化生成迁移文件
python manage.py migrate            # 执行迁移（真正改数据库）
python manage.py check              # 自检（配置/依赖基本检查）
python manage.py showmigrations     # 查看迁移状态
python manage.py runserver          # 启动开发服务器
```

---

## 故障排查

- `docker compose ps` 不 healthy
  - 打开 Docker Desktop，等待小鲸鱼就绪；
  - `docker compose logs db` 查看报错；
  - 如端口被占用，参考上文端口改法。
- `migrate` 失败
  - 确认数据库健康；
  - 对齐 `.env` 的 `DATABASE_URL` 与 compose 的端口/用户名/密码/库名；
  - 再执行：`python manage.py migrate --plan` 预览步骤。
- 跨域 / CSRF
  - CORS：把前端页面的源写到 `CORS_ALLOWED_ORIGINS`；
  - CSRF：如用 Cookie/Session 发起修改类请求，需要把带协议的页面域写到 `CSRF_TRUSTED_ORIGINS`（如 `https://app.example.com`）。

---

## CI：工作流与健康检查

本仓库已包含最小可用的 GitHub Actions 工作流：`/.github/workflows/ci.yml`（位于仓库根目录 `.github/workflows/`）。

注意：该工作流将 steps 的工作目录设置为 `project-consensus-backend/`，因此 `pip install -r requirements.txt`、`python manage.py migrate` 等命令会在后端子目录下执行。

流程包括：

1. 拉取代码（`actions/checkout`）。
2. 启动 PostgreSQL 17 服务并等待健康（`pg_isready` 健康检查）。
3. 安装 Python 3.13，创建虚拟环境并安装 `project-consensus-backend/requirements.txt`。
4. 写入一份用于 CI 的最小 `.env`（`DATABASE_URL` 指向上面那台 Postgres 17）。
5. 执行 `python manage.py migrate --noinput`。
6. 执行一次“烟雾测试”（`django.setup()` 成功即通过）。

如何确认 CI 正常工作：

前往 GitHub 仓库 “Actions” 页面查看运行记录，应全部通过（尤其是 Migrate、Smoke test）。

---

## 协作规范

- 请在新分支开发：`feature/<your-task>` → 提 PR → 过 CI → 代码审查 → 合并到 `main`。
- 有需要升级依赖时：修改 `requirements.in` → 运行 `pip-compile` → 提交 `requirements.in` + `requirements.txt` 一起。
- 不要把 `.env`、`.venv/`、本地生成缓存入库（请在根仓库 `.gitignore` 配置忽略）。

---

## 附录：可选的 pyenv 安装（安装 Python 3.13.7）

如果本机还没有 3.13.7，推荐用 pyenv 管理 Python 版本

```bash
# 安装 Homebrew（若还没有）
# 参考 brew 官网；或执行：/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 pyenv 及构建依赖
brew install pyenv openssl readline sqlite3 xz zlib tcl-tk

# 配置 zsh 初始化
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.zshrc
echo 'export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.zshrc
echo 'eval "$(pyenv init -)"' >> ~/.zshrc
exec $SHELL

# 安装并全局/本地使用 3.13.7
pyenv install 3.13.7
pyenv local 3.13.7     # 在项目目录下绑定
python -V               # 应显示 3.13.7
```

---
