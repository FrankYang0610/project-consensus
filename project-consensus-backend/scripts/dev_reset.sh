#!/usr/bin/env bash
set -euo pipefail

# Move to backend root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${BACKEND_DIR}"

echo "[dev-reset] Backend dir: ${BACKEND_DIR}"

# 1) Python venv and dependencies
if [ ! -d .venv ]; then
  echo "[dev-reset] Creating virtualenv .venv"
  python3 -m venv .venv
fi
source .venv/bin/activate
python -m pip install -U pip wheel
pip install -r requirements.txt

# 2) Write .env if missing
if [ ! -f .env ]; then
  echo "[dev-reset] Creating .env"
  cat > .env << 'EOF'
SECRET_KEY=dev-secret
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost
DATABASE_URL=postgres://postgres:postgres@localhost:5432/appdb
CORS_ALLOWED_ORIGINS=http://localhost:3000
CSRF_TRUSTED_ORIGINS=http://localhost:3000
EOF
fi

# 3) Reset and start Postgres container
echo "[dev-reset] Resetting Docker Postgres"
docker compose down -v || true
docker compose up -d db

echo "[dev-reset] Waiting for Postgres (container: dj_db17) to be ready..."
for i in {1..60}; do
  if docker exec dj_db17 pg_isready -U postgres -d appdb >/dev/null 2>&1; then
    echo "[dev-reset] Postgres is ready."
    break
  fi
  sleep 1
  if [ "$i" -eq 60 ]; then
    echo "[dev-reset] Postgres did not become ready in time." >&2
    exit 1
  fi
done

# 4) Free port 8000 if occupied
echo "[dev-reset] Ensuring port 8000 is free"
PIDS="$(lsof -ti tcp:8000 || true)"
if [ -n "${PIDS}" ]; then
  echo "[dev-reset] Killing processes on 8000: ${PIDS}"
  kill -9 ${PIDS} || true
fi

# 5) Migrate
echo "[dev-reset] Running database migrations"
python manage.py migrate

# 6) Run server (skip if NO_RUN=1)
if [ "${NO_RUN:-0}" = "1" ]; then
  echo "[dev-reset] NO_RUN=1 set; skipping runserver."
else
  echo "[dev-reset] Starting server at 127.0.0.1:8000"
  python manage.py runserver
fi


