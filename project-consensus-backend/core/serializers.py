"""
Serializers for core app.
"""
from rest_framework import serializers
from django.conf import settings
from django.core.validators import FileExtensionValidator
from PIL import Image


class ImageUploadSerializer(serializers.Serializer):
    """
    Serializer for image upload with validation.
    
    Uses DRF's built-in ImageField with custom validators:
    - File size limits (max and min)
    - Extension whitelist
    - Image dimension limits (decompression bomb protection)
    """
    image = serializers.ImageField(
        required=True,
        help_text="Image file to upload (JPEG/PNG/GIF/WebP)",
        # DRF's ImageField already validates it's a valid image via Pillow
        validators=[
            FileExtensionValidator(
                allowed_extensions=settings.ALLOWED_IMAGE_EXTENSIONS
            )
        ]
    )
    folder = serializers.ChoiceField(
        choices=['images', 'avatars', 'posts', 'wiki'],
        default='images',
        required=False,
        help_text="Target folder in storage"
    )
    
    def validate_image(self, value):
        """
        Custom validation for image file.
        
        Checks:
        - File size (min and max)
        - Image dimensions (prevent decompression bombs)
        """
        # Min size check
        if value.size < 100:
            raise serializers.ValidationError(
                "File too small. Minimum size: 100 bytes"
            )
        
        # Max size check
        max_size = getattr(settings, 'MAX_IMAGE_SIZE', 5 * 1024 * 1024)
        if value.size > max_size:
            max_mb = max_size / (1024 * 1024)
            raise serializers.ValidationError(
                f"File too large. Maximum size: {max_mb:.1f}MB"
            )
        
        # Dimension check (decompression bomb protection)
        try:
            img = Image.open(value)
            max_pixels = getattr(settings, 'MAX_IMAGE_PIXELS', 50_000_000)
            if img.width * img.height > max_pixels:
                raise serializers.ValidationError(
                    f"Image resolution too high. Maximum: {max_pixels:,} pixels"
                )
            value.seek(0)  # Reset file pointer for later use
        except serializers.ValidationError:
            raise
        except Exception as e:
            raise serializers.ValidationError(f"Invalid image: {str(e)}")
        
        return value
