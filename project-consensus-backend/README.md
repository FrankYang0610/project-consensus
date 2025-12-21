## project-consensus-backend

### Getting Started

Please ensure you have Python 3.13.7+ and Docker Desktop installed on your system. Then you can deploy the backend locally according to the following steps.

#### 1. **Clone the repository** (if you haven't already):
```bash
git clone https://github.com/FrankYang0610/project-consensus/
cd project-consensus-backend
```

#### 2. **Install Python dependencies**:
```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

#### 3. **Configure environment variables**:
```bash
# Copy example environment file
cp .env.example .env

# Edit .env and configure at minimum:
#   DEBUG=True
#   SECRET_KEY=your-secret-key-here
#   ALLOWED_HOSTS=127.0.0.1,localhost
#   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/appdb
#   CORS_ALLOWED_ORIGINS=http://localhost:3000
#   CSRF_TRUSTED_ORIGINS=http://localhost:3000
```

#### 4. **Start PostgreSQL database** (using Docker):
```bash
# Ensure Docker Desktop is running
docker compose up -d

# Verify database is healthy
docker compose ps  # db should show "healthy"
```

#### 5. **Initialize database**:
```bash
# Run migrations
python manage.py migrate
```

#### 6. **Start the development server**:
```bash
python manage.py runserver
```

The API will be available at [http://127.0.0.1:8000](http://127.0.0.1:8000). Verify by visiting [http://127.0.0.1:8000/api/health/](http://127.0.0.1:8000/api/health/) which should return `{"status":"ok"}`.

---

### Directory Structure

```
project-consensus-backend/
├── accounts/                                  # User Authentication & Profile Management
│   ├── __init__.py
│   ├── apps.py                                # Django app configuration
│   ├── models.py                              # User Profile model (one-to-one with User)
│   ├── serializers.py                         # Profile, Author, Registration serializers
│   ├── views.py                               # Authentication endpoints (login, register, etc.)
│   ├── urls.py                                # Account API routes
│   ├── selectors.py                           # Database query helpers
│   ├── error_codes.py                         # Error code definitions
│   ├── tasks.py                               # Celery async tasks (email sending)
│   ├── services/                              # Business Logic Services
│   │   ├── auth_service.py                    # Authentication service
│   │   ├── email_service.py                   # Email sending service (Resend API)
│   │   ├── password_reset_service.py          # Password reset flow
│   │   ├── password_change_service.py         # Password change service
│   │   ├── profile_service.py                 # Profile management service
│   │   ├── privacy_service.py                 # Privacy settings service
│   │   └── session_service.py                 # Session management service
│   ├── templates/                             # Email Templates
│   │   └── emails/
│   │       ├── password_reset/                # Password reset email templates
│   │       └── verification_code/             # Email verification code templates
│   ├── migrations/                            # Database migrations
│   │   ├── 0001_initial.py                    # Initial schema
│   │   └── 0002_create_demo_user.py           # Demo user seed data
│   └── README.md                              # Accounts app documentation
│
├── config/                                    # Django Project Configuration
│   ├── __init__.py
│   ├── settings.py                            # Django settings (database, CORS, etc.)
│   ├── urls.py                                # Root URL configuration
│   ├── wsgi.py                                # WSGI application entry point
│   ├── asgi.py                                # ASGI application entry point
│   └── celery.py                              # Celery configuration for async tasks
│
├── core/                                      # Core Functionality Module
│   ├── __init__.py
│   ├── models.py                              # Core models (currently empty)
│   ├── views.py                               # Global search and health check endpoints
│   ├── views_upload.py                        # Image upload API (Cloudflare R2)
│   ├── serializers.py                         # Search and upload serializers
│   ├── validators.py                          # URL/host validators for uploads
│   ├── utils.py                               # Image upload/delete utilities
│   ├── permissions.py                         # Custom permission classes
│   ├── admin.py                               # Django admin configuration
│   ├── tests.py                               # Core app tests
│   ├── presentation/                          # Presentation layer utilities
│   ├── search_services/                       # Global Search Services
│   │   ├── __init__.py
│   │   ├── search_services.py                 # Main search service implementation
│   │   ├── search_algorithms.py               # Search algorithm implementations
│   │   ├── search_utils.py                    # Search utility functions
│   │   ├── search_exceptions.py               # Search-specific exceptions
│   │   └── README.md                          # Search service documentation
│   ├── security/                              # Security utilities
│   ├── migrations/                            # Database migrations
│   │   └── 0001_initial.py                    # Initial schema
│   └── README.md                              # Core app documentation
│
├── courses/                                   # Course Management & Review System
│   ├── __init__.py
│   ├── models.py                              # Course, CourseReview, CourseReviewReply models
│   ├── serializers.py                         # Course and review serializers (camelCase)
│   ├── views.py                               # Course and review ViewSets
│   ├── urls.py                                # Course API routes
│   ├── user_activity_urls.py                  # User activity routes (reviews, replies)
│   ├── validators.py                          # Course data validators
│   ├── pagination.py                          # Custom pagination classes
│   ├── annotations.py                         # Query annotations for aggregations
│   ├── admin.py                               # Django admin configuration
│   ├── services/                              # Course Business Logic Services
│   │   ├── __init__.py
│   │   ├── course_queries.py                  # Course query builders
│   │   ├── course_filters.py                  # Course filtering logic
│   │   ├── course_utils.py                    # Course utility functions
│   │   ├── course_stats.py                    # Course statistics calculation
│   │   ├── course_aggregates.py               # Course aggregate updates
│   │   ├── course_get_teachers.py             # Teacher retrieval for courses
│   │   ├── course_get_other_teacher_courses.py  # Other teacher courses logic
│   │   ├── course_review_read.py              # Review read operations
│   │   ├── course_review_create.py            # Review creation logic
│   │   ├── course_review_update.py            # Review update logic
│   │   ├── course_review_delete.py            # Review deletion logic
│   │   ├── course_review_stats.py             # Review statistics
│   │   ├── course_review_utils.py             # Review utility functions
│   │   ├── course_review_like.py              # Review like/unlike logic
│   │   ├── course_review_reply_read.py        # Reply read operations
│   │   ├── course_review_reply_create.py      # Reply creation logic
│   │   ├── course_review_reply_delete.py      # Reply deletion logic
│   │   ├── course_review_reply_like.py        # Reply like/unlike logic
│   │   ├── course_voting.py                   # Course recommend/not-recommend voting
│   │   ├── course_notification.py             # Course-related notifications
│   │   ├── course_image_cleanup.py            # Course image cleanup utilities
│   │   └── README.md                          # Services documentation
│   ├── presentation/                          # Presentation layer
│   │   └── author.py                          # Author presentation utilities
│   ├── security/                              # Security utilities
│   │   └── html.py                            # HTML sanitization for course content
│   ├── migrations/                            # Database migrations
│   │   ├── 0001_initial.py                    # Initial schema
│   │   └── 0002_import_courses_from_database.py  # Course data import
│   └── README.md                              # Courses app documentation
│
├── forum/                                     # Forum Posts & Comments System
│   ├── __init__.py
│   ├── models.py                              # ForumPost, ForumPostComment models
│   ├── serializers.py                         # Forum post and comment serializers
│   ├── views.py                               # Forum ViewSets
│   ├── urls.py                                # Forum API routes
│   ├── user_activity_urls.py                  # User activity routes (posts, comments)
│   ├── utils.py                               # Forum utility functions
│   ├── presentation/                          # Presentation layer
│   │   └── author.py                          # Author presentation utilities
│   ├── security/                              # Security utilities
│   │   └── html.py                            # HTML sanitization for forum content
│   ├── services/                              # Forum Business Logic Services
│   │   ├── forum_post_service.py              # Post creation/update logic
│   │   ├── forum_comment_service.py           # Comment creation/update logic
│   │   ├── forum_like_service.py              # Like/unlike logic
│   │   ├── forum_filter_service.py            # Post filtering logic
│   │   ├── forum_search_service.py            # Post search logic
│   │   └── forum_notification_service.py      # Forum-related notifications
│   ├── migrations/                            # Database migrations
│   │   ├── 0001_initial.py                    # Initial schema
│   │   └── 0002_seed_demo_forum_data.py       # Demo forum data seed
│   └── README.md                              # Forum app documentation
│
├── teachers/                                  # Teacher Information Management
│   ├── __init__.py
│   ├── models.py                              # Teacher model
│   ├── serializers.py                         # Teacher serializers (camelCase)
│   ├── views.py                               # Teacher ViewSet
│   ├── urls.py                                # Teacher API routes
│   ├── admin.py                               # Django admin configuration
│   ├── services/                              # Teacher Business Logic Services
│   │   ├── teacher_queries.py                 # Teacher query builders
│   │   ├── teacher_search.py                  # Teacher search logic
│   │   ├── teacher_aggregates.py              # Teacher rating aggregation
│   │   ├── teacher_courses.py                 # Teacher-course relationship logic
│   │   └── teacher_utils.py                   # Teacher utility functions
│   ├── migrations/                            # Database migrations
│   │   ├── 0001_initial.py                    # Initial schema
│   │   └── 0002_seed_demo_teachers.py         # Demo teacher data seed
│   └── README.md                              # Teachers app documentation
│
├── wiki/                                      # Wiki Knowledge Base System
│   ├── __init__.py
│   ├── models.py                              # WikiCategory, WikiPage models
│   ├── serializers.py                         # Wiki serializers
│   ├── views.py                               # Wiki ViewSets
│   ├── urls.py                                # Wiki API routes
│   ├── permissions.py                         # Wiki permission classes
│   ├── admin.py                               # Django admin configuration
│   ├── migrations/                            # Database migrations
│   │   ├── 0001_initial.py                    # Initial schema
│   │   ├── 0002_seed_wiki_data.py             # Wiki seed data
│   │   └── 0003_bcp47_language_update.py      # Language code update
│   ├── README.md                              # Wiki app documentation (Chinese)
│   └── README.en.md                           # Wiki app documentation (English)
│
├── notifications/                             # Notification System
│   ├── __init__.py
│   ├── models.py                              # Notification model
│   ├── views.py                               # Notification ViewSet
│   ├── urls.py                                # Notification API routes
│   ├── events.py                              # Notification event definitions
│   ├── signals.py                             # Django signals for notifications
│   ├── runtime.py                             # Runtime notification utilities
│   └── migrations/                            # Database migrations
│       ├── 0001_initial.py                    # Initial schema
│       └── 0002_seed_notifications.py         # Notification seed data
│
├── database/                                  # Database Seed Data
│   ├── courses/                               # Course seed data
│   │   └── courses.json                       # Course JSON data
│   ├── teachers/                              # Teacher seed data
│   │   └── [JSON files]                       # Individual teacher JSON files
│   ├── teachers-old/                          # Legacy teacher data
│   │   └── [JSON files]                       # Old teacher JSON files
│   └── teacher_fetcher.py                     # Teacher data fetcher utility
│
├── scripts/                                   # Development & Deployment Scripts
│   ├── dev-reset.sh                           # Development environment reset script
│   ├── dev-restart.sh                         # Development server restart script
│   ├── start-celery.sh                        # Celery worker startup script
│   └── systemd/                               # Systemd service files
│
├── manage.py                                  # Django management script
├── docker-compose.yml                         # Docker Compose configuration (PostgreSQL)
├── requirements.in                            # Python dependencies (source)
├── requirements.txt                           # Python dependencies (locked)
├── db.sqlite3                                 # SQLite database (development fallback)
└── README.md                                  # This file
```

---

### API Endpoints Overview

#### Core Endpoints
- `GET /api/health/` - Health check endpoint
- `GET /api/search/` - Global search across courses, teachers, forum posts, wiki, and users
- `POST /api/upload/image/` - Image upload to Cloudflare R2 storage

#### Accounts Endpoints (`/api/accounts/`)
- `POST /api/auth/login/` - User login
- `POST /api/auth/register/` - User registration
- `POST /api/auth/send_verification_code/` - Send email verification code
- `POST /api/auth/logout/` - User logout
- `GET /api/auth/profile/` - Get current user profile
- `PUT /api/auth/profile/` - Update user profile
- `POST /api/auth/password/reset/` - Request password reset
- `POST /api/auth/password/reset/confirm/` - Confirm password reset
- `POST /api/auth/password/change/` - Change password

#### Courses Endpoints (`/api/courses/`)
- `GET /api/courses/` - List courses (with search, filters, sorting)
- `GET /api/courses/{courseId}/` - Get course detail
- `GET /api/courses/{courseId}/reviews/` - List course reviews
- `POST /api/courses/{courseId}/reviews/` - Create course review
- `POST /api/courses/{courseId}/vote/` - Vote recommend/not-recommend
- `GET /api/courses/departments/` - Get list of departments
- `GET /api/reviews/` - List reviews (with filters)
- `POST /api/reviews/` - Create review
- `POST /api/reviews/{id}/like/` - Like review
- `POST /api/reviews/{id}/unlike/` - Unlike review
- `GET /api/replies/` - List review replies
- `POST /api/replies/` - Create reply
- `POST /api/replies/{id}/like/` - Like reply
- `POST /api/replies/{id}/unlike/` - Unlike reply

#### Teachers Endpoints (`/api/teachers/`)
- `GET /api/teachers/` - List teachers (with search, filters, sorting)
- `GET /api/teachers/{id}/` - Get teacher detail
- `GET /api/teachers/{id}/courses/` - Get courses taught by teacher

#### Forum Endpoints (`/api/forum/`)
- `GET /api/forum/posts/` - List forum posts
- `POST /api/forum/posts/` - Create forum post
- `GET /api/forum/posts/{id}/` - Get forum post detail
- `PUT /api/forum/posts/{id}/` - Update forum post
- `DELETE /api/forum/posts/{id}/` - Delete forum post
- `GET /api/forum/comments/` - List forum comments
- `POST /api/forum/comments/` - Create forum comment
- `GET /api/forum/comments/position/` - Get comment position in feed

#### Wiki Endpoints (`/api/wiki/`)
- `GET /api/wiki/categories/` - List wiki categories
- `GET /api/wiki/categories/{id}/` - Get category detail
- `GET /api/wiki/pages/` - List wiki pages
- `GET /api/wiki/pages/{id}/` - Get wiki page detail
- `POST /api/wiki/pages/` - Create wiki page (staff only)
- `PUT /api/wiki/pages/{id}/` - Update wiki page (staff only)
- `DELETE /api/wiki/pages/{id}/` - Delete wiki page (staff only)

#### Notifications Endpoints (`/api/notifications/`)
- `GET /api/notifications/` - List user notifications
- `PUT /api/notifications/{id}/read/` - Mark notification as read
- `PUT /api/notifications/read-all/` - Mark all notifications as read

---

### Configuration

#### Environment Variables (`.env`)

**Required:**
- `DEBUG=True` - Enable debug mode (development)
- `SECRET_KEY=...` - Django secret key (use strong random in production)
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/appdb` - PostgreSQL connection string

**Optional:**
- `ALLOWED_HOSTS=127.0.0.1,localhost` - Allowed host headers
- `LANGUAGE_CODE=zh-hans` - Default language (e.g., `en-us`, `zh-hans`)
- `TIME_ZONE=Asia/Shanghai` - Timezone (e.g., `UTC`, `Europe/Berlin`)
- `CORS_ALLOWED_ORIGINS=http://localhost:3000` - CORS allowed origins (comma-separated)
- `CSRF_TRUSTED_ORIGINS=http://localhost:3000` - CSRF trusted origins (comma-separated)

**Email Configuration (for Resend API):**
- `RESEND_API_KEY=...` - Resend API key for transactional emails

**Storage Configuration (for Cloudflare R2):**
- `AWS_ACCESS_KEY_ID=...` - R2 access key ID
- `AWS_SECRET_ACCESS_KEY=...` - R2 secret access key
- `AWS_STORAGE_BUCKET_NAME=...` - R2 bucket name
- `AWS_S3_ENDPOINT_URL=...` - R2 endpoint URL

**Celery Configuration (for async tasks):**
- `CELERY_BROKER_URL=redis://localhost:6379/0` - Redis broker URL
- `CELERY_RESULT_BACKEND=rpc://` - Result backend (default: RPC)

#### Docker Compose

The `docker-compose.yml` file configures PostgreSQL 17:
- Container name: `dj_db17`
- Port: `5432:5432` (change if port is occupied)
- Username: `postgres`
- Password: `postgres`
- Database: `appdb`

If port 5432 is occupied, modify `docker-compose.yml`:
```yaml
ports:
  - "55432:5432"
```
And update `.env` `DATABASE_URL` accordingly:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/appdb
```

---

### Common Commands

#### Docker / Database
```bash
docker compose up -d                 # Start database
docker compose stop                  # Stop database
docker compose logs -f db            # Follow database logs
docker exec -it dj_db17 psql -U postgres -d appdb   # Enter psql shell
```

#### Django
```bash
python manage.py makemigrations      # Generate migration files
python manage.py migrate             # Apply migrations
python manage.py check               # Check configuration
python manage.py showmigrations      # Show migration status
python manage.py runserver           # Start development server
python manage.py createsuperuser     # Create admin user
```

#### Development Scripts
```bash
# Reset development environment (recreates DB, runs migrations, starts server)
# Also see section: `dev-reset` Script
bash scripts/dev-reset.sh

# Reset without starting server
NO_RUN=1 bash scripts/dev-reset.sh

# Restart development server
bash scripts/dev-restart.sh

# Start Celery worker (for async tasks)
bash scripts/start-celery.sh
```

#### `dev-reset` Script

**⚠️ Warning: Only use this script in your local environment!**

This script:
- Creates `.venv` if missing and installs requirements
- Creates `.env` if missing (Postgres on localhost:5432)
- `docker compose down -v && docker compose up -d db`
- Waits for container `dj_db17` to be ready
- Kills any process on port 8000
- Runs `python manage.py migrate`
- Runs `python manage.py runserver` (unless `NO_RUN=1`)

---

### Troubleshooting

**Database not healthy:**
- Ensure Docker Desktop is running
- Check logs: `docker compose logs db`
- If port is occupied, adjust ports in `docker-compose.yml` and update `.env`

**Migration fails:**
- Ensure database is healthy: `docker compose ps`
- Verify `DATABASE_URL` in `.env` matches Docker Compose configuration
- Preview migrations: `python manage.py migrate --plan`

**CORS / CSRF errors:**
- Add frontend origin to `CORS_ALLOWED_ORIGINS` in `.env`
- Add frontend origin to `CSRF_TRUSTED_ORIGINS` in `.env` (for cookie-based auth)

**Import errors:**
- Ensure virtual environment is activated: `source .venv/bin/activate`
- Reinstall dependencies: `pip install -r requirements.txt`

---

### CI/CD

A GitHub Actions workflow is configured at `/.github/workflows/ci.yml` (under repo root).

The workflow:
1. Checks out code
2. Starts PostgreSQL 17 and waits for health
3. Installs Python 3.13, creates venv, installs dependencies
4. Writes minimal `.env` for CI
5. Runs migrations: `python manage.py migrate --noinput`
6. Runs smoke test (verifies Django setup)

To verify CI, visit the repository's "Actions" tab; runs should pass.

---

### Development Workflow

1. **Create feature branch**: `git checkout -b feature/your-feature`
2. **Make changes**: Edit code, add tests
3. **Run migrations** (if model changes): `python manage.py makemigrations`
4. **Test locally**: `python manage.py runserver`
5. **Commit changes**: `git commit -m "Add feature"`
6. **Push and create PR**: Push to GitHub and create pull request
7. **CI runs automatically**: GitHub Actions verifies changes
8. **Code review**: After CI passes, request review
9. **Merge**: After approval, merge into `main`

---

### Dependency Management

- Edit `requirements.in` to add/update dependencies
- Compile locked dependencies: `pip-compile -o requirements.txt requirements.in`
- Commit both `requirements.in` and `requirements.txt`

---

### Architecture Notes

- **Framework**: Django 5 + Django REST Framework (DRF)
- **Database**: PostgreSQL 17 (via Docker)
- **Task Queue**: Celery with Redis broker
- **Storage**: Cloudflare R2 (S3-compatible) for images
- **Email**: Resend API for transactional emails
- **API Format**: camelCase JSON responses (aligned with frontend TypeScript types)
- **Authentication**: Session-based authentication with CSRF protection
- **Permissions**: Role-based access control (anonymous, authenticated, staff)

For detailed architecture documentation, see `README.celery-and-ops.md`.

---

### Additional Resources

- **Accounts App**: See `accounts/README.md` for authentication and profile management
- **Courses App**: See `courses/README.md` for course and review system details
- **Forum App**: See `forum/README.md` for forum posts and comments
- **Teachers App**: See `teachers/README.md` for teacher information management
- **Wiki App**: See `wiki/README.md` for wiki knowledge base
- **Core App**: See `core/README.md` for global search and image upload
- **Search Services**: See `core/search_services/README.md` for search implementation
- **Celery & Operations**: See `README.celery-and-ops.md` for async tasks and infrastructure

