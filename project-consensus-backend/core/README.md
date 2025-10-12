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
├── utils.py               # Image processing utility functions
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
        # DRF's ImageField automatically validates:
        # - Whether file can be opened by Pillow
        # - Whether it's a valid image format
        validators=[
            # Django built-in validator: extension whitelist
            FileExtensionValidator(
                allowed_extensions=['jpg', 'jpeg', 'png', 'gif', 'webp']
            )
        ]
    )
    folder = serializers.ChoiceField(
        # Restrict folder selection to prevent path traversal attacks
        choices=['images', 'avatars', 'posts', 'wiki']
    )

    def validate_image(self, value):
        """Custom validation logic"""
        # File size check
        if value.size < 100:  # Minimum
            raise ValidationError(...)
        if value.size > MAX_IMAGE_SIZE:  # Maximum
            raise ValidationError(...)

        # Pixel dimension check (prevent decompression bomb)
        img = Image.open(value)
        if img.width * img.height > 50_000_000:
            raise ValidationError(...)

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

| Level      | Validation Content | Implementation Method         |
| ---------- | ------------------ | ----------------------------- |
| **Auth**   | User must login    | `IsAuthenticated`             |
| **Rate**   | 100 times/hour     | `UserRateThrottle`            |
| **Ext**    | jpg/png/gif/webp   | `FileExtensionValidator`      |
| **Format** | Real image file    | DRF `ImageField` (Pillow)     |
| **Size**   | 100 bytes - 5MB    | Serializer `validate_image()` |
| **Pixels** | Max 50MP           | Serializer `validate_image()` |
| **Path**   | Limited folders    | `ChoiceField`                 |

---

## 📊 Configuration Parameters

All configurable parameters (in `settings.py`):

```python
# Allowed image extensions
ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp']

# Maximum file size (bytes)
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB

# Maximum pixels (prevent decompression bomb)
MAX_IMAGE_PIXELS = 50_000_000  # 50 megapixels

# Rate limiting
REST_FRAMEWORK = {
    "DEFAULT_THROTTLE_RATES": {
        "image_upload": "100/hour",
    },
}

# Cloudflare R2 configuration
STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "access_key": env("R2_ACCESS_KEY_ID"),
            "secret_key": env("R2_SECRET_ACCESS_KEY"),
            "bucket_name": env("R2_BUCKET_NAME"),
            "endpoint_url": env("R2_ENDPOINT_URL"),
            "custom_domain": env("R2_PUBLIC_DOMAIN"),
        },
    },
}
```

---
