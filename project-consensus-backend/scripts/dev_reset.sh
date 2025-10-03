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

# 5) Rebuild migrations (backup seeds, regenerate 0001, restore seeds)
# SKIPPED: Migration files are now preserved and not regenerated
echo "[dev-reset] Skipping migration rebuild (migrations are preserved)"

# # Step 5a: Backup seed migration files
# TEMP_SEED_DIR="/tmp/project-consensus-seeds-$$"
# mkdir -p "${TEMP_SEED_DIR}"
# echo "[dev-reset] Backing up seed migrations to ${TEMP_SEED_DIR}"
# 
# [ -f "accounts/migrations/0002_create_demo_user.py" ] && \
#   cp "accounts/migrations/0002_create_demo_user.py" "${TEMP_SEED_DIR}/"
# [ -f "courses/migrations/0002_seed.py" ] && \
#   cp "courses/migrations/0002_seed.py" "${TEMP_SEED_DIR}/"
# [ -f "forum/migrations/0002_seed_demo_forum_data.py" ] && \
#   cp "forum/migrations/0002_seed_demo_forum_data.py" "${TEMP_SEED_DIR}/"
# 
# # Step 5b: Delete ALL migration files (except __init__.py)
# for app in accounts courses forum teachers core; do
#   if [ -d "${app}/migrations" ]; then
#     echo "[dev-reset] Deleting all migrations in ${app}"
#     find "${app}/migrations" -type f -name "*.py" ! -name "__init__.py" -delete
#     find "${app}/migrations" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
#   fi
# done
# 
# # Step 5c: Generate fresh 0001_initial.py migrations
# echo "[dev-reset] Generating new 0001_initial.py migrations"
# python manage.py makemigrations
# 
# # Step 5d: Restore seed migrations
# echo "[dev-reset] Restoring seed migrations"
# [ -f "${TEMP_SEED_DIR}/0002_create_demo_user.py" ] && \
#   cp "${TEMP_SEED_DIR}/0002_create_demo_user.py" "accounts/migrations/"
# [ -f "${TEMP_SEED_DIR}/0002_seed.py" ] && \
#   cp "${TEMP_SEED_DIR}/0002_seed.py" "courses/migrations/"
# [ -f "${TEMP_SEED_DIR}/0002_seed_demo_forum_data.py" ] && \
#   cp "${TEMP_SEED_DIR}/0002_seed_demo_forum_data.py" "forum/migrations/"
# 
# # Cleanup temp directory
# rm -rf "${TEMP_SEED_DIR}"
# echo "[dev-reset] Seed migrations restored"

# 6) Migrate
echo "[dev-reset] Running database migrations"
python manage.py migrate

# 7) Run server (skip if NO_RUN=1)
if [ "${NO_RUN:-0}" = "1" ]; then
  echo "[dev-reset] NO_RUN=1 set; skipping runserver."
else
  echo "[dev-reset] Starting server at 127.0.0.1:8000"
  python manage.py runserver
fi


