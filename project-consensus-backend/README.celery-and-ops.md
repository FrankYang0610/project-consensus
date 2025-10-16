# Backend Architecture, Connection Configuration, Failover, and Retry Guide

This document explains the backend architecture, dependency connections, Celery/Redis/email reliability settings, failover, and retry strategies based on the current codebase and scripts. Key files involved:

- `project-consensus-backend/config/settings.py`
- `project-consensus-backend/config/celery.py`
- `project-consensus-backend/accounts/services/email_service.py`
- `project-consensus-backend/accounts/tasks.py`
- `project-consensus-backend/accounts/views.py`
- `project-consensus-backend/docker-compose.yml`
- `project-consensus-backend/scripts/start-celery.sh`
- `project-consensus-backend/scripts/dev_reset.sh`

```mermaid
graph LR
  subgraph "Django API"
    A[Django + DRF]
  end
  A -->|"DATABASE_URL"| B[(PostgreSQL 17<br/>via Docker)]
  A -->|"Cache/Throttle"| C[Cache<br/>(default LocMem,<br/>configurable via CACHE_URL)]
  A -->|"S3Storage"| D[Cloudflare R2]
  A -->|"Resend API"| E[Transactional Email]
  A -->|"Celery Broker"| F[Redis]
  F -->|"Fetch Tasks"| G[Celery Worker]
  G -->|"Send"| E
```

## Architecture and Key Modules

- **Django API**: Applications located in `accounts/`, `courses/`, `forum/`, etc.
- **Database**: PostgreSQL 17 (Docker container name `dj_db17`), connected via `DATABASE_URL` from `.env`.
- **Task Queue**: Celery uses Redis as the broker (Docker container name `dj_redis`).
- **Result Storage**: Default `CELERY_RESULT_BACKEND='rpc://'` (temporary results, not persistent).
- **Object Storage**: Cloudflare R2 (via `storages.backends.s3.S3Storage`).
- **Email Sending**: Resend API, service encapsulated in `accounts/services/email_service.py`, async tasks in `accounts/tasks.py`.

## Connection Configuration (.env and settings)

- **Django Basics**
  - `DEBUG`, `SECRET_KEY`, `ALLOWED_HOSTS`, `LANGUAGE_CODE`, `TIME_ZONE`
  - CORS/CSRF: `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`
- **PostgreSQL**
  - `DATABASE_URL` example: `postgresql://postgres:postgres@localhost:5432/appdb`
  - Compose exposes `5432:5432` (see `docker-compose.yml`)
- **Redis (Celery Broker)**
  - `CELERY_BROKER_URL` example: `redis://:redis_secure_password@localhost:6379/0`
  - Note: Password must match `--requirepass redis_secure_password` in `docker-compose.yml`
- **Celery**
  - `config/celery.py` loads `CELERY_*` configurations from `settings.py` via `namespace='CELERY'`
  - Reliability related (see next section)
- **Object Storage (R2)**
  - `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_DOMAIN`
  - `STORAGES["default"]` points to S3Storage and sets `endpoint_url` to R2
- **Email (Resend)**
  - `EMAIL_ENABLED`, `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_REPLY_TO`
  - Recommended to quote values containing spaces: `"PolyU Life <noreply@polyu.life>"`

**Tips:**

- If the same key appears multiple times in `.env`, the last one takes precedence (e.g., your `R2_PUBLIC_DOMAIN` has two lines, the last one takes effect).
- `EMAIL_TIMEOUT_SECONDS` in your `.env` is not currently used by the codebase.

## Celery/Redis Reliability and Retry

- **Broker Auto-reconnection (Global)** (`config/settings.py`)
  - `CELERY_BROKER_CONNECTION_RETRY = True`
  - `CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True`
  - `CELERY_BROKER_CONNECTION_MAX_RETRIES = None` (infinite retries)
- **Task Acknowledgment/Loss Handling**
  - `CELERY_TASK_ACKS_LATE = True` (acknowledge tasks after completion to avoid loss on worker crash)
  - `CELERY_TASK_REJECT_ON_WORKER_LOST = True` (requeue tasks if worker is lost)
- **Visibility Timeout/Health Check (Redis Transport Layer)**
  - `CELERY_BROKER_TRANSPORT_OPTIONS = { visibility_timeout: 3600, health_check_interval: 30, ... }`
  - macOS does not set socket keepalive options; Linux enables keepalive for faster disconnection detection (platform differentiation already in code)
- **Task-level Retry (Exponential Backoff + Jitter)** (`accounts/tasks.py`)
  - `@shared_task(... max_retries=3, default_retry_delay=60, autoretry_for=(Exception,), retry_backoff=True, retry_jitter=True, retry_backoff_max=600)` (verification email task)
  - Password reset task also has auto-retry configured (without `retry_backoff_max`, but with `retry_backoff=True`)
- **Worker Runtime Parameters**
  - `scripts/start-celery.sh` startup parameters:
    - `--concurrency=8`
    - `--time-limit=300`, `--soft-time-limit=240`
  - Note: Script's `time-limit` overrides `CELERY_TASK_TIME_LIMIT/SOFT_TIME_LIMIT` in `settings.py` (settings: 30/25 minutes, script: 5/4 minutes). Script takes precedence.

## Failover and Fallback Strategies

- **Email Sending Fallback** (`accounts/views.py`)
  - When `EMAIL_ENABLED=True` and `EMAIL_USE_CELERY=True`:
    - Prefer async delivery: `send_*_email_async.delay(...)`
    - If task queuing fails: Catch exception and "fallback to synchronous sending" to ensure users may still receive emails promptly (won't block user interface flow)
  - When `EMAIL_ENABLED=True` and `EMAIL_USE_CELERY=False`:
    - Use synchronous sending (development/fallback scenario)
  - When `EMAIL_ENABLED=False`:
    - No actual email sending; print verification code or reset link in logs (development mode)
- **Security-friendly Behavior for Verification Requests** (`accounts/views.py`)
  - For registered emails: Don't actually send email, but return success and set throttling to avoid account enumeration
  - Sending rate limiting: Use DRF throttle and cache for rate limiting and TTL control
- **Redis Unavailability Protection**
  - `scripts/start-celery.sh` checks Redis reachability before startup (`redis-cli` or `docker exec dj_redis redis-cli`), exits with prompt to start Redis if unreachable
  - Celery globally enables broker auto-reconnection; continues working after Redis recovery

## Script Descriptions

- **`scripts/dev_reset.sh`**
  - Create and activate virtual environment, install dependencies
  - If no `.env`, write a minimal usable template
  - `docker compose down -v && docker compose up -d db redis` reset and start Postgres and Redis
  - Wait for `dj_db17` and `dj_redis` to be healthy (up to 60s)
  - Free port 8000 (if occupied)
  - Run `python manage.py migrate`
  - Start `runserver` by default (can skip with `NO_RUN=1`)
- **`scripts/start-celery.sh`**
  - Check if `.env` exists (warn but don't interrupt)
  - Check Redis reachability via `redis-cli` or `docker exec`, exit with prompt to `docker compose up -d redis` if unreachable
  - Start Celery Worker:
    - `-A config worker --loglevel=info --concurrency=8 --max-tasks-per-child=1000 --time-limit=300 --soft-time-limit=240`

## Recommended Local Development Steps

1. Start Dependencies and Backend
   ```bash
   # In project-consensus-backend/ directory
   bash scripts/dev_reset.sh
   # Browser access: http://127.0.0.1:8000/api/health/ expected {"status":"ok"}
   ```
2. Start Celery Worker (for async emails)
   ```bash
   # Ensure .env has:
   # EMAIL_ENABLED=true
   # EMAIL_USE_CELERY=true
   # CELERY_BROKER_URL=redis://:redis_secure_password@localhost:6379/0
   bash scripts/start-celery.sh
   ```
3. Frontend-Backend Integration
   - CORS/CSRF: Add frontend origin to `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`

## Common Issues and Troubleshooting

- **Redis Connection Failed**
  - Confirm `docker compose up -d redis` is running, password matches `CELERY_BROKER_URL` (`redis_secure_password`)
  - Running `bash scripts/start-celery.sh` provides clear prompts
- **Postgres Not Ready or Port Conflict**
  - `docker compose logs -f db` check health checks
  - If local port 5432 is occupied, change port in `docker-compose.yml` and sync update `DATABASE_URL` in `.env`
- **Email Not Sending**
  - Confirm `EMAIL_ENABLED=true` and `RESEND_API_KEY` is valid, domain verified through Resend
  - For async: Confirm `EMAIL_USE_CELERY=true` and Celery Worker is running
  - Development mode (`EMAIL_ENABLED=false`): Logs print verification code/reset link
- **Duplicate .env Keys**
  - Later defined values override previous ones, ensure final values meet expectations
- **Timeout Settings**
  - `EMAIL_TIMEOUT_SECONDS` in `.env` is not currently used (can be integrated into `EmailService` if needed)
