"""
Utility functions for file uploads.
"""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError
from django.core.files.storage import default_storage

if TYPE_CHECKING:
    from django.core.files.uploadedfile import UploadedFile


def upload_image_to_r2(file: UploadedFile, folder: str = 'images') -> str:
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
    
    Returns:
        Public URL of uploaded image
    
    Raises:
        ValidationError: If upload fails
    """
    # Extract file extension
    original_name = file.name or 'image'
    extension = original_name.rsplit('.', 1)[-1].lower() if '.' in original_name else 'jpg'
    
    # Generate unique filename
    unique_id = uuid.uuid4()
    filename = f"{folder}/{unique_id}.{extension}"
    
    # Upload to R2
    try:
        file.seek(0)  # Reset file pointer
        path = default_storage.save(filename, file)
        url = default_storage.url(path)
        return url
    except Exception as e:
        raise ValidationError(f"Failed to upload image: {str(e)}")
