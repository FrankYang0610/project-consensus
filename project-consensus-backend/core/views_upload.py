"""
Image upload API view using DRF best practices.
"""
import logging
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.throttling import UserRateThrottle

from django.core.exceptions import ValidationError as DjangoValidationError
from core.serializers import ImageUploadSerializer
from core.utils import upload_image_to_r2


logger = logging.getLogger(__name__)


class ImageUploadRateThrottle(UserRateThrottle):
    """Rate limit for image uploads: 100 per hour per user."""
    scope = 'image_upload'


class ImageUploadView(APIView):
    """
    API endpoint for uploading images to Cloudflare R2.
    
    POST /api/upload/image/
    
    **Authentication**: Required (IsAuthenticated)
    
    **Rate Limiting**: 100 uploads per hour per user
    
    **Request** (multipart/form-data):
    - `image` (file, required): Image file (JPEG/PNG/GIF/WebP)
    - `folder` (string, optional): Target folder ('images', 'avatars', 'posts', 'wiki')
    
    **Response**:
    - 200: `{"url": "https://..."}`
    - 400: `{"error": "Invalid file", "detail": {...}}`
    - 401: `{"error": "Authentication required"}`
    - 413: `{"error": "File too large"}`
    - 429: `{"error": "Too many requests"}`
    
    **Security Features**:
    - File type validation (extension whitelist)
    - File size limits (100 bytes - 5MB)
    - Image format verification (PIL)
    - Decompression bomb protection (50MP max)
    - Folder path restriction
    """
    
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [ImageUploadRateThrottle]
    
    def post(self, request):
        """
        Handle image upload.
        
        Supports both 'image' and 'upload' field names for compatibility:
        - 'image': Used by custom upload forms (e.g., AvatarUpload)
        - 'upload': Used by CKEditor SimpleUploadAdapter
        
        Returns:
            200: {"url": "https://..."}
            400: {"error": "...", "detail": {...}}
        """
        # Normalize field name: CKEditor uses 'upload', we use 'image'
        # Note: Can't use .copy() on request.data as it contains file objects
        data = {}
        if 'upload' in request.data and 'image' not in request.data:
            data['image'] = request.data['upload']
        else:
            data['image'] = request.data.get('image')
        
        # Copy folder parameter if present
        if 'folder' in request.data:
            data['folder'] = request.data['folder']
        
        serializer = ImageUploadSerializer(data=data)
        
        if not serializer.is_valid():
            logger.warning(f"Image validation failed during upload: user={request.user.id}, errors={serializer.errors}")
            return Response(
                {
                    "error": "Invalid upload request",
                    "detail": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            image_file = serializer.validated_data['image']
            folder = serializer.validated_data.get('folder', 'images')
            
            url = upload_image_to_r2(image_file, folder=folder)
            
            logger.info(f"Image uploaded successfully: user={request.user.id}, size={image_file.size}, folder={folder}")
            return Response({"url": url}, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Image upload failed: user={request.user.id}, error={str(e)}", exc_info=True)
            return Response(
                {"error": "Failed to upload image. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
