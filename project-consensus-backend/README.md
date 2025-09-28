# Project Overview

Django + DRF + PostgreSQL 17 backend template.

- Python: 3.13.7
- Locked dependencies: see `requirements.txt`
- DB: run PostgreSQL 17 via Docker (consistent local env)
- Config: `.env` (not committed)
- CI: GitHub Actions (on every push/PR, verify deps install and DB migrations)

> Note: This README lives under `project-consensus-backend/`. Commands below assume this directory as the working directory.

---

## Quick Start (macOS)

For macOS. Follow in order for first-time setup.

```bash
# 1) Install Docker Desktop (choose one)
#   A) Homebrew (recommended):
brew install --cask docker
#   After install, open Docker.app once from Applications and wait
#   for the whale icon to indicate Docker is ready.
#   B) Or download the DMG from Docker's website and open Docker.app.

# 2) Clone the repo (if you haven't) and enter the backend directory
# git clone <repo-url> && cd <repo-folder>/project-consensus-backend

# 3) Install/activate a Python 3.13.7 virtual environment
#! If using anaconda/conda and it auto-activates, run: conda deactivate

python3 -V                       # ensure 3.13.7 (or 3.13.x)
python3 -m venv .venv
source .venv/bin/activate
python -V && pip -V


# 4) Install dependencies (locked)
pip install -r requirements.txt

# 5) Configure environment variables (copy from example)
cp .env.example .env
# Edit .env and at minimum confirm:
#   DEBUG=True
#   SECRET_KEY=any non-empty string (use strong random in production)
#   ALLOWED_HOSTS=127.0.0.1,localhost
#   LANGUAGE_CODE=zh-hans (optional, default zh-hans; set en-us for English)
#   TIME_ZONE=Asia/Shanghai (optional, default Asia/Shanghai; e.g., UTC)
#   CORS_ALLOWED_ORIGINS=http://localhost:3000 (if you have a frontend)
#   CSRF_TRUSTED_ORIGINS=http://localhost:3000 (the frontend origin making POST requests)
#   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/appdb

# 6) Start PostgreSQL 17 (ensure Docker Desktop is running)
docker compose up -d
docker compose ps    # db should show "healthy"

# 7) Initialize DB and start the dev server
python manage.py migrate
python manage.py runserver

# 8) Verify
# Open in browser: http://127.0.0.1:8000/api/health/ ; expected:
# {"status":"ok"}
```

---

## Configuration

- `.env` (local):
  - `DEBUG=True` (development)
  - `SECRET_KEY=...` (use strong random in production and inject via env)
  - `ALLOWED_HOSTS=127.0.0.1,localhost`
  - `LANGUAGE_CODE=zh-hans` (optional, default zh-hans; e.g., `en-us`)
  - `TIME_ZONE=Asia/Shanghai` (optional, default Asia/Shanghai; e.g., `UTC`, `Europe/Berlin`)
  - `CORS_ALLOWED_ORIGINS=http://localhost:3000` (if you have a frontend)
  - `CSRF_TRUSTED_ORIGINS=http://localhost:3000` (the frontend origin making POST requests)
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/appdb`
- `docker-compose.yml`: uses `postgres:17`, port `5432:5432`, username/password `postgres`, database `appdb`.

  - If local port 5432 is occupied, change to:

    ```yaml
    ports:
      - "55432:5432"
    ```

    and update `.env` `DATABASE_URL` accordingly:

    ```
    postgresql://postgres:postgres@localhost:55432/appdb
    ```

---

## Common Commands

- Docker / Database

```bash
docker compose up -d               # start DB
docker compose stop                # stop DB
docker compose logs -f db          # follow DB logs
docker exec -it dj_db17 psql -U postgres -d appdb   # enter psql
# In psql:
#   \dt
#   select count(*) from django_migrations;
#   \q
```

- Django

```bash
python manage.py makemigrations     # generate migration files from model changes
python manage.py migrate            # apply migrations (change the DB)
python manage.py check              # self-check (basic config/deps)
python manage.py showmigrations     # show migration status
python manage.py runserver          # start dev server
```

---

## Troubleshooting

- `docker compose ps` not healthy
  - Open Docker Desktop and wait until it is ready.
  - Check logs with `docker compose logs db`.
  - If the port is occupied, adjust ports as above.
- `migrate` fails
  - Ensure the database is healthy.
  - Align `.env` `DATABASE_URL` with compose port/username/password/db name.
  - Preview steps with: `python manage.py migrate --plan`.
- CORS / CSRF
  - CORS: add your frontend origin to `CORS_ALLOWED_ORIGINS`.
  - CSRF: if using cookies/session for modifying requests, add scheme + domain to `CSRF_TRUSTED_ORIGINS` (e.g., `https://app.example.com`).

---

## CI: Workflow & Health Checks

A minimal GitHub Actions workflow is included: `/.github/workflows/ci.yml` (under the repo root `.github/workflows/`).

Note: The workflow sets the steps' working directory to `project-consensus-backend/`, so commands like `pip install -r requirements.txt` and `python manage.py migrate` run in the backend subdirectory.

Pipeline includes:

1. Checkout (`actions/checkout`).
2. Start PostgreSQL 17 and wait for health (`pg_isready`).
3. Install Python 3.13, create a venv, and install `project-consensus-backend/requirements.txt`.
4. Write a minimal `.env` for CI (`DATABASE_URL` points to the Postgres 17 service).
5. Run `python manage.py migrate --noinput`.
6. Run a smoke test (pass if `django.setup()` succeeds).

To verify CI:

Visit the repository's “Actions” tab; runs should pass (especially Migrate and Smoke test).

---

## Collaboration

- Develop on feature branches: `feature/<your-task>` → PR → pass CI → review → merge into `main`.
- For dependency upgrades: edit `requirements.in` → run `pip-compile` → commit both `requirements.in` and `requirements.txt`.
- Do not commit `.env`, `.venv/`, or local caches (configure ignores in the repo root `.gitignore`).

---

## Appendix: Optional pyenv (Install Python 3.13.7)

If you don't have 3.13.7 locally, manage Python with pyenv:

```bash
# Install Homebrew (if missing)
# See brew website; or run: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install pyenv and build deps
brew install pyenv openssl readline sqlite3 xz zlib tcl-tk

# Configure zsh initialization
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.zshrc
echo 'export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.zshrc
echo 'eval "$(pyenv init -)"' >> ~/.zshrc
exec $SHELL

# Install and use 3.13.7
pyenv install 3.13.7
pyenv local 3.13.7     # bind in the project directory
python -V               # should show 3.13.7
```

---

## One-command Dev Reset Script (Only for Development Environment!!!!)

For convenience, a helper script resets the dev environment, frees port 8000, re-creates the database (Docker Postgres), runs migrations (including forum seed), and starts the server.

```bash
cd /Users/frankyang/project-consensus/project-consensus-backend
bash scripts/dev_reset.sh
```

Run only up to migration without starting the server:

```bash
NO_RUN=1 bash scripts/dev_reset.sh
```

What the script does:
- Create `.venv` if missing and install requirements
- Create `.env` if missing (Postgres on localhost:5432)
- `docker compose down -v && docker compose up -d db`
- Wait for container `dj_db17` to be ready
- Kill any process on port 8000
- Run `python manage.py migrate`
- Run `python manage.py runserver` (unless `NO_RUN=1`)
