# Core App - Core Functionality Module

## 📋 Overview

The `core` app provides the project's core functionality, including global search, health checks, and image upload.

## 📁 File Structure

```
core/
├── __init__.py
├── models.py              # (Empty) No data models
├── views.py               # Search and health check views
├── views_upload.py        # Image upload API (class-based view)
├── serializers.py         # Data validation serializers
├── validators.py          # Shared URL/host validators for uploads
├── utils.py               # Image upload/delete utility functions
└── README.md             # This document
```

---

## 🔍 Feature Modules

### 1. Global Search (`views.py::search`)

**Endpoint**: `GET /api/search/?q=keyword&type=courses`

Unified search interface across multiple models, supporting:

- Courses (courses)
- Teachers (teachers)
- Forum posts (forum_posts)
- Wiki pages (wiki)
- Users (users)

**Search Algorithm**: PostgreSQL Trigram similarity + popularity weight

### 2. Health Check (`views.py::health`)

**Endpoint**: `GET /api/health/`

Returns server status for monitoring and load balancer detection.

### 3. Image Upload (`views_upload.py::ImageUploadView`)

**Endpoint**: `POST /api/upload/image/`

Secure image upload service that uploads to Cloudflare R2 storage.

Request (multipart/form-data):

- `image` (file, required) or `upload` (file, CKEditor-compatible)
- `folder` (string, optional): one of `images | avatars | posts | wiki`

Response:

- 200: `{ "url": "https://..." }`
- 400: `{ "error": "Invalid upload request", "detail": {...} }`
- 429: `{ "detail": "Request was throttled..." }`

---

## 📤 Image Upload API Detailed Explanation

### Architecture Design

```
Client Request
    ↓
[MultiPartParser] Parse multipart/form-data
    ↓
[ImageUploadSerializer] Validate data
    ├── DRF ImageField: Verify it's a real image (using Pillow)
    ├── FileExtensionValidator: Whitelist extension check
    └── validate_image(): File size + pixel dimension check
    ↓
[ImageUploadView.post()] Handle business logic
    ↓
[upload_image_to_r2()] Upload to R2
    └── default_storage.save(): Upload original file to R2
    ↓
Return public URL
```

### Key Components

#### 1. `ImageUploadSerializer` (serializers.py)

**Using DRF Built-in Validators** - Following best practices!

```python
class ImageUploadSerializer(serializers.Serializer):
    image = serializers.ImageField(
        required=True,
        help_text="Image file to upload (JPEG/PNG/GIF/WebP)",
        # DRF's ImageField already validates via Pillow
        validators=[
            FileExtensionValidator(
                allowed_extensions=settings.ALLOWED_IMAGE_EXTENSIONS
            )
        ]
    )
    folder = serializers.ChoiceField(
        choices=['images', 'avatars'],
        default='images',
        required=False,
        help_text="Target folder in storage"
    )

    def validate_image(self, value):
        """Custom validation for image file (size and dimensions)."""
        # Min size
        if value.size < 100:
            raise serializers.ValidationError(
                "File too small. Minimum size: 100 bytes"
            )

        # Max size
        max_size = getattr(settings, 'MAX_IMAGE_SIZE', 5 * 1024 * 1024)
        if value.size > max_size:
            raise serializers.ValidationError("File too large.")

        # Dimension check (decompression bomb protection)
        try:
            img = Image.open(value)
            max_pixels = getattr(settings, 'MAX_IMAGE_PIXELS', 50_000_000)
            if img.width * img.height > max_pixels:
                raise serializers.ValidationError("Image resolution too high.")
            value.seek(0)  # Reset file pointer for later use
        except serializers.ValidationError:
            raise
        except Exception as e:
            raise serializers.ValidationError(f"Invalid image: {str(e)}")

        return value
```

**Why use built-in validators?**

- ✅ **DRF ImageField**: Already uses Pillow to validate image authenticity
- ✅ **FileExtensionValidator**: Django built-in, no need to write extension checks
- ✅ **Reduce code**: From ~50 lines to ~30 lines
- ✅ **Better error messages**: DRF automatically formats error responses

#### 2. `ImageUploadView` (views_upload.py)

**Class-based View (APIView)** - DRF recommended approach

```python
class ImageUploadView(APIView):
    permission_classes = [IsAuthenticated]      # Authentication
    parser_classes = [MultiPartParser, FormParser]  # Parse uploaded files
    throttle_classes = [ImageUploadRateThrottle]    # Rate limiting

    def post(self, request):
        # 1. Validate data
        serializer = ImageUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        # 2. Upload file
        image_file = serializer.validated_data['image']
        folder = serializer.validated_data.get('folder', 'images')
        url = upload_image_to_r2(image_file, folder=folder)

        # 3. Return result
        return Response({"url": url}, status=200)
```

**Advantages**:

- ✅ Clear separation of concerns
- ✅ Easy to test
- ✅ Follows DRF style guide

#### 3. `upload_image_to_r2()` (utils.py)

Utility function that handles direct image upload (no optimization).

```python
def upload_image_to_r2(file, folder='images'):
    """
    Upload to Cloudflare R2:
    1. Generate unique filename (UUID)
    2. Upload original file to storage
    3. Return public URL

    Note: No optimization is performed.
    File size is already limited by the serializer.
    """
    ...
```

#### 4. Image Deletion and Ownership (`utils.py`)

- `delete_images_in_html(html, owner_user_id)` extracts `<img src>` from HTML and attempts to delete only those images that:
  - map to HTTPS URLs on allowed hosts, and
  - resolve to storage keys under allowed folders (`images/`, `avatars/`, `posts/`, `wiki/`), and
  - belong to the specified `owner_user_id` (path prefix `<folder>/<userId>/...`).
- `delete_storage_object_by_url(url, owner_user_id)` performs the same checks for a single URL.
- Path safety: dot segments (`.`/`..`) are rejected when parsing storage keys.

Call sites (best-effort cleanup):

- `accounts/views.py::update_profile()` – delete old avatar after change
- `courses/views.py::CourseReviewViewSet.perform_destroy()` – delete images in a review on delete
- `forum/views.py::ForumPostViewSet.destroy()` – delete images in a post and all its comments on delete
- `forum/views.py::ForumPostCommentViewSet.destroy()` – delete images in a comment on delete

---

## 🚦 Rate Limiting (Throttling) Detailed Explanation

### What is Rate Limiting?

Limits the number of requests a user can make within a certain time period to prevent abuse and attacks.

### Implementation Principle

#### 1. Configure Rate (`settings.py`)

```python
REST_FRAMEWORK = {
    "DEFAULT_THROTTLE_RATES": {
        "image_upload": "100/hour",  # 100 times per hour
    },
}
```

#### 2. Define Throttle Class (`views_upload.py`)

```python
class ImageUploadRateThrottle(UserRateThrottle):
    """
    Inherits DRF's UserRateThrottle
    - Rate limit based on user ID
    - Uses sliding window algorithm
    """
    scope = 'image_upload'  # Corresponds to key in settings
```

#### 3. Apply to View

```python
class ImageUploadView(APIView):
    throttle_classes = [ImageUploadRateThrottle]
    ...
```

### Workflow

```
User Request → DRF Middleware
            ↓
        Check request records in cache
            ↓
        key: throttle_image_upload_user_123
        value: [timestamp1, timestamp2, ...]
            ↓
    Delete expired timestamps (over 1 hour)
            ↓
    Count remaining timestamps
            ↓
    If < 100: Allow request, add new timestamp
    If >= 100: Reject request, return 429
```

### Cache Key Format

```python
# UserRateThrottle's cache key
throttle_{scope}_{user_id}

# Example
throttle_image_upload_123   # User ID 123
throttle_image_upload_456   # User ID 456
```

### Sliding Window Algorithm

**Not fixed window** (e.g., reset every hour), but **sliding window**:

```
Fixed Window (bad):
10:00-11:00 → 100 times
11:00-12:00 → 100 times
May upload 100 times at 10:59, then 100 times at 11:01 = 200 times in 2 minutes

Sliding Window (good):
Any moment look back 1 hour
10:30 → Check requests from 09:30-10:30
11:00 → Check requests from 10:00-11:00
More smooth and fair
```

### Response Format

**Success** (200 OK):

```json
{
  "url": "https://..."
}
```

**Rate Limited** (429 Too Many Requests):

```json
{
  "detail": "Request was throttled. Expected available in 3542 seconds."
}
```

**HTTP Headers**:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 23
X-RateLimit-Reset: 1642012345
```

### Custom Throttle Strategy

If more complex throttling is needed (such as multi-level throttling):

```python
class BurstImageUploadThrottle(UserRateThrottle):
    """Short-term burst limit"""
    scope = 'image_upload_burst'
    rate = '3/minute'

class ImageUploadView(APIView):
    throttle_classes = [
        BurstImageUploadThrottle,  # Check short-term first
        ImageUploadRateThrottle,   # Check long-term next
    ]
```

---

## 🔒 Security Features Summary

| Level      | Validation Content | Implementation Method            |
| ---------- | ------------------ | -------------------------------- |
| **Auth**   | User must login    | `IsAuthenticated`                |
| **Rate**   | 100 times/hour     | `UserRateThrottle`               |
| **Ext**    | jpg/png/gif/webp   | `FileExtensionValidator`         |
| **Format** | Real image file    | DRF `ImageField` (Pillow)        |
| **Size**   | 100 bytes - 5MB    | Serializer `validate_image()`    |
| **Pixels** | Max 50MP           | Serializer `validate_image()`    |
| **Path**   | Limited folders    | `ChoiceField` + server allowlist |
| **Scheme** | HTTPS only         | URL parsing + validators         |
| **Host**   | Allowed domains    | `ALLOWED_IMAGE_HOSTS`            |
| **Delete** | Owner-only cleanup | Path ownership check             |

---

## 📊 Configuration Parameters

All configurable parameters (in `settings.py`):

```python
# Image upload validation
ALLOWED_IMAGE_EXTENSIONS = [
    ext.strip().lower()
    for ext in env("ALLOWED_IMAGE_TYPES", default="jpg,jpeg,png,gif,webp").split(",")
]
MAX_IMAGE_SIZE = env.int("MAX_IMAGE_SIZE_MB", default=5) * 1024 * 1024
MAX_IMAGE_PIXELS = env.int("MAX_IMAGE_PIXELS", default=50_000_000)

# Allowed public image hosts (rendering and deletion safety)
ALLOWED_IMAGE_HOSTS = [
    h.strip().lower() for h in env("ALLOWED_IMAGE_HOSTS", default="image.polyu.life").split(",") if h.strip()
]

# DRF throttling
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["image_upload"] = "100/hour"

# Cloudflare R2 (django-storages S3 backend)
STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": env("R2_BUCKET_NAME"),
            "access_key": env("R2_ACCESS_KEY_ID"),
            "secret_key": env("R2_SECRET_ACCESS_KEY"),
            "endpoint_url": f'https://{env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com',
            "region_name": "auto",
            "custom_domain": env("R2_PUBLIC_DOMAIN"),
            "default_acl": None,
            "file_overwrite": False,
            "object_parameters": {"CacheControl": "max-age=86400"},
        },
    },
}
```

---
