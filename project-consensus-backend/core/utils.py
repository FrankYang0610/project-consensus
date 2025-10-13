"""
Utility functions for file uploads.
"""
from __future__ import annotations

import uuid
from urllib.parse import urlparse
from typing import TYPE_CHECKING
from html.parser import HTMLParser

from django.core.exceptions import ValidationError
from django.core.files.storage import default_storage
from core.validators import get_allowed_image_hosts, is_host_in_allowed

if TYPE_CHECKING:
    from django.core.files.uploadedfile import UploadedFile


_ALLOWED_FOLDERS = {'images', 'avatars', 'posts', 'wiki'}


def upload_image_to_r2(file: UploadedFile, folder: str = 'images', user=None) -> str:
    """
    Upload an image to Cloudflare R2 and return the public URL.
    
    Process:
    1. Generate unique filename
    2. Upload to R2
    3. Return public URL
    
    Note: Validation is handled by ImageUploadSerializer before this function.
    
    Args:
        file: Uploaded image file (already validated)
        folder: Folder/prefix in R2 bucket (e.g., 'avatars', 'posts')
        user: Optional user object to include owner id in the path
    
    Returns:
        Public URL of uploaded image
    
    Raises:
        ValidationError: If upload fails
    """
    folder = str(folder).strip() if folder is not None else 'images'
    if folder not in _ALLOWED_FOLDERS:
        raise ValidationError("Invalid folder")
    # Extract file extension
    original_name = file.name or 'image'
    extension = original_name.rsplit('.', 1)[-1].lower() if '.' in original_name else 'jpg'
    
    # Generate unique filename
    unique_id = uuid.uuid4()
    owner_segment = f"{getattr(user, 'pk', None)}/" if user is not None and getattr(user, 'pk', None) is not None else ""
    filename = f"{folder}/{owner_segment}{unique_id}.{extension}"
    
    # Upload to R2
    try:
        file.seek(0)  # Reset file pointer
        path = default_storage.save(filename, file)
        url = default_storage.url(path)
        return url
    except Exception as e:
        raise ValidationError(f"Failed to upload image: {str(e)}")


def url_to_storage_path(url: str) -> str | None:
    try:
        if not url:
            return None
        parsed = urlparse(str(url).strip())
        if not parsed.scheme or not parsed.netloc:
            return None
        if str(parsed.scheme).lower() != 'https':
            return None
        allowed_hosts = get_allowed_image_hosts()
        if not is_host_in_allowed(parsed.hostname, allowed_hosts):
            return None
        path = parsed.path.lstrip('/')
        if not path:
            return None
        # Reject ambiguous or traversal-like segments
        parts = path.split('/')
        for seg in parts:
            if seg in ('.', '..', ''):
                return None
        return path
    except Exception:
        return None


def _storage_path_belongs_to_user(path: str, user_id: int | None) -> bool:
    try:
        if not path or user_id is None:
            return False
        parts = path.split('/')
        if len(parts) < 3:
            return False
        if parts[0] not in _ALLOWED_FOLDERS:
            return False
        return parts[1] == str(user_id)
    except Exception:
        return False


def delete_storage_object_by_url(url: str, owner_user_id: int | None = None) -> bool:
    try:
        path = url_to_storage_path(url)
        if not path:
            return False
        if owner_user_id is not None and not _storage_path_belongs_to_user(path, owner_user_id):
            return False
        default_storage.delete(path)
        return True
    except Exception:
        return False


class _ImgSrcExtractor(HTMLParser):
    """
    Extracts src attributes from <img> tags in HTML.
    
    Security Note: This class performs NO validation or sanitization.
    It is intentionally minimal. All security validation (hostname checking,
    ownership verification) is performed downstream in delete_storage_object_by_url().

    """
    def __init__(self):
        super().__init__()
        self.srcs: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag and tag.lower() == 'img':
            for (k, v) in attrs:
                if k and k.lower() == 'src' and v:
                    self.srcs.append(v)


def extract_image_srcs_from_html(html: str) -> set[str]:
    try:
        if not html or not isinstance(html, str):
            return set()
        parser = _ImgSrcExtractor()
        parser.feed(html)
        return set(parser.srcs)
    except Exception:
        return set()


def delete_images_in_html(html: str, owner_user_id: int) -> int:
    """
    Delete images referenced in HTML content.
    
    Security: Requires owner_user_id to prevent unauthorized deletions.
    Only deletes images that:
    1. Are hosted on allowed domains (validated by url_to_storage_path)
    2. Belong to the specified owner (validated by _storage_path_belongs_to_user)
    
    Args:
        html: HTML content containing <img> tags
        owner_user_id: Required. User ID that owns the content/images.
                      Images not belonging to this user will NOT be deleted.
    
    Returns:
        Number of images successfully deleted
    """
    if not html or not isinstance(html, str):
        return 0
    if owner_user_id is None:
        # Security: Never allow deletion without ownership verification
        raise ValueError("owner_user_id is required for secure image deletion")
    
    parser = _ImgSrcExtractor()
    try:
        parser.feed(html)
    except Exception:
        # Best-effort: if parsing fails, nothing is deleted
        return 0
    
    deleted = 0
    for src in parser.srcs:
        # Each URL is validated in delete_storage_object_by_url:
        # - Must be from allowed host
        # - Must belong to owner_user_id
        if delete_storage_object_by_url(src, owner_user_id=owner_user_id):
            deleted += 1
    return deleted
