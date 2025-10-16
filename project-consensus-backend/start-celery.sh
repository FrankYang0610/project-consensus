#!/bin/bash
# Celery Worker Startup Script
# Starts Celery worker for async task processing (email sending, etc.)

# Exit on error
set -e

echo "========================================"
echo "Starting Celery Worker"
echo "========================================"
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found, using .env.example as template"
    echo "Please create .env file with your configuration"
    echo ""
fi

# Check if Redis is running
echo "Checking Redis connection..."
# Prefer host redis-cli when available; otherwise try docker exec into dj_redis
if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli -a redis_secure_password ping >/dev/null 2>&1; then
        echo "✅ Redis is running"
    else
        # fallback to docker exec
        if docker ps --format '{{.Names}}' | grep -q '^dj_redis$'; then
            if docker exec dj_redis redis-cli -a redis_secure_password ping >/dev/null 2>&1; then
                echo "✅ Redis is running (via docker exec)"
            else
                echo "❌ Redis is not accessible!"
                echo ""
                echo "Please start Redis with Docker:"
                echo "  cd $SCRIPT_DIR"
                echo "  docker compose up -d redis"
                echo ""
                exit 1
            fi
        else
            echo "❌ Redis is not accessible!"
            echo ""
            echo "Please start Redis with Docker:"
            echo "  cd $SCRIPT_DIR"
            echo "  docker compose up -d redis"
            echo ""
            exit 1
        fi
    fi
else
    # No host redis-cli; try docker exec directly
    if docker ps --format '{{.Names}}' | grep -q '^dj_redis$'; then
        if docker exec dj_redis redis-cli -a redis_secure_password ping >/dev/null 2>&1; then
            echo "✅ Redis is running (via docker exec)"
        else
            echo "❌ Redis is not accessible!"
            echo ""
            echo "Please start Redis with Docker:"
            echo "  cd $SCRIPT_DIR"
            echo "  docker compose up -d redis"
            echo ""
            exit 1
        fi
    else
        echo "❌ Redis is not accessible!"
        echo ""
        echo "Please start Redis with Docker:"
        echo "  cd $SCRIPT_DIR"
        echo "  docker compose up -d redis"
        echo ""
        exit 1
    fi
fi

echo ""
echo "Starting Celery worker..."
echo "  - Project: config"
echo "  - Log level: info"
echo "  - Concurrency: 8 workers"
echo ""
echo "Press Ctrl+C to stop"
echo "========================================"
echo ""

# Start Celery worker (use project venv if available)
CELERY_BIN="celery"
if [ -x "./.venv/bin/celery" ]; then
    CELERY_BIN="./.venv/bin/celery"
fi

exec "$CELERY_BIN" -A config worker \
    --loglevel=info \
    --concurrency=8 \
    --max-tasks-per-child=1000 \
    --time-limit=300 \
    --soft-time-limit=240
