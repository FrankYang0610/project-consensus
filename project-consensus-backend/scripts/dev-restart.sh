#!/usr/bin/env bash
set -euo pipefail

# Lightweight backend restart: same as dev-reset.sh but WITHOUT resetting or migrating the database.

# Move to backend root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${BACKEND_DIR}"

echo "[dev-restart] Backend dir: ${BACKEND_DIR}"

# 1) Python venv and dependencies
if [ ! -d .venv ]; then
  echo "[dev-restart] Creating virtualenv .venv"
  python3 -m venv .venv
fi
source .venv/bin/activate
# Pin to a pip version that retains InstallRequirement.use_pep517 for compatibility with pip-tools
python -m pip install -U "pip<24.1" wheel "pip-tools>=7.5.0"

# Compile requirements.txt from requirements.in if needed or forced
if [ ! -f requirements.txt ] || [ requirements.in -nt requirements.txt ] || [ "${FORCE_COMPILE:-0}" = "1" ]; then
  echo "[dev-restart] Compiling requirements.txt from requirements.in"
  python -m piptools compile --quiet --output-file=requirements.txt requirements.in
fi

pip install -r requirements.txt

# 2) Write .env if missing
if [ ! -f .env ]; then
  echo "[dev-restart] Creating .env"
  cat > .env << 'EOF'
SECRET_KEY=dev-secret
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost
DATABASE_URL=postgres://postgres:postgres@localhost:5432/appdb
CORS_ALLOWED_ORIGINS=http://localhost:3000
CSRF_TRUSTED_ORIGINS=http://localhost:3000
EOF
fi

# 3) Ensure Postgres and Redis containers are up (no down -v)
echo "[dev-restart] Ensuring Docker Postgres and Redis are running"
docker compose up -d db redis

# Wait for Postgres (container: dj_db17) to be ready...
echo "[dev-restart] Waiting for Postgres (container: dj_db17) to be ready..."
for i in {1..60}; do
  if docker exec dj_db17 pg_isready -U postgres -d appdb >/dev/null 2>&1; then
    echo "[dev-restart] Postgres is ready."
    break
  fi
  sleep 1
  if [ "$i" -eq 60 ]; then
    echo "[dev-restart] Postgres did not become ready in time." >&2
    exit 1
  fi
done

# Also wait for Redis to be ready
echo "[dev-restart] Waiting for Redis (container: dj_redis) to be ready..."
for i in {1..60}; do
  if docker exec dj_redis redis-cli -a redis_secure_password ping >/dev/null 2>&1; then
    echo "[dev-restart] Redis is ready."
    break
  fi
  sleep 1
  if [ "$i" -eq 60 ]; then
    echo "[dev-restart] Redis did not become ready in time." >&2
    exit 1
  fi
done

# 4) Free port 8000 if occupied
echo "[dev-restart] Ensuring port 8000 is free"
PIDS="$(lsof -ti tcp:8000 || true)"
if [ -n "${PIDS}" ]; then
  echo "[dev-restart] Killing processes on 8000: ${PIDS}"
  kill -9 ${PIDS} || true
fi


echo "[dev-restart] Starting server at 127.0.0.1:8000"
python manage.py runserver
