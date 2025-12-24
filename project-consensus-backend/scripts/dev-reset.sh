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
# Pin to a pip version that retains InstallRequirement.use_pep517 for compatibility with pip-tools
python -m pip install -U "pip<24.1" wheel "pip-tools>=7.5.0"

# Compile requirements.txt from requirements.in if needed or forced
if [ ! -f requirements.txt ] || [ requirements.in -nt requirements.txt ] || [ "${FORCE_COMPILE:-0}" = "1" ]; then
  echo "[dev-reset] Compiling requirements.txt from requirements.in"
  python -m piptools compile --quiet --output-file=requirements.txt requirements.in
fi

pip install -r requirements.txt

# 2) Write .env if missing
if [ ! -f .env ]; then
  echo "[dev-reset] Creating .env"
  cat > .env << 'EOF'
SECRET_KEY=dev-secret
DEBUG=True
SEED_DEMO_DATA=true
ALLOWED_HOSTS=127.0.0.1,localhost
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/appdb
CORS_ALLOWED_ORIGINS=http://localhost:3000
CSRF_TRUSTED_ORIGINS=http://localhost:3000

# For password reset links, etc.
FRONTEND_BASE_URL=http://localhost:3000

# Redis (docker-compose.yml enables requirepass=redis_secure_password)
CELERY_BROKER_URL=redis://:redis_secure_password@localhost:6379/0
NOTIFICATIONS_REDIS_URL=redis://:redis_secure_password@localhost:6379/1
CACHE_URL=redis://:redis_secure_password@localhost:6379/2

# Email (dev)
EMAIL_ENABLED=false
EMAIL_USE_CELERY=false

# Cloudflare R2 (dummy defaults for local dev; set real credentials to use uploads)
R2_ACCOUNT_ID=your_r2_account_id
R2_BUCKET_NAME=your_bucket_name
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_PUBLIC_DOMAIN=your_public_domain.r2.dev
EOF
fi

# 3) Reset and start Postgres container
echo "[dev-reset] Resetting Docker Postgres"
docker compose down -v || true
docker compose up -d db redis

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

# Also wait for Redis to be ready
echo "[dev-reset] Waiting for Redis (container: dj_redis) to be ready..."
for i in {1..60}; do
  if docker exec dj_redis redis-cli -a redis_secure_password ping >/dev/null 2>&1; then
    echo "[dev-reset] Redis is ready."
    break
  fi
  sleep 1
  if [ "$i" -eq 60 ]; then
    echo "[dev-reset] Redis did not become ready in time." >&2
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

# --- SSE local testing notes ---
# Basic: `runserver` is sufficient for SSE functionality in development.
# High concurrency (low workers): set NO_RUN=1 and launch a dedicated ASGI instance:
#   source .venv/bin/activate
#   uvicorn config.asgi:application \
#     --host 127.0.0.1 --port 8011 --workers 1 --loop uvloop --http httptools
# Then point only `/api/notifications/stream/` to http://127.0.0.1:8011 (frontend or curl).
# Celery is not required for SSE.

# 6) Run server (skip if NO_RUN=1)
if [ "${NO_RUN:-0}" = "1" ]; then
  echo "[dev-reset] NO_RUN=1 set; skipping runserver."
else
  echo "[dev-reset] Starting server at 127.0.0.1:8000 (SSE OK; for high-concurrency use ASGI, see comments above)"
  python manage.py runserver
fi


