from __future__ import annotations

import asyncio
import logging

from django.http import StreamingHttpResponse, HttpRequest, HttpResponse
from django.conf import settings
from asgiref.sync import sync_to_async
from rest_framework.decorators import api_view, permission_classes
from rest_framework import status, permissions
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

# Reuse Notification model from accounts to avoid DB migrations during decoupling
from .models import Notification
from .runtime import publish, subscribe_async


logger = logging.getLogger(__name__)


class DefaultNotificationPageNumberPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


def _author_payload_for(user) -> dict:
    profile = getattr(user, "profile", None)
    if profile is not None:
        return profile.author_payload
    return {"id": str(user.pk), "name": user.get_username(), "avatar": None}


def _get_course_id_from_notification(n: Notification) -> str | None:
    # Prefer metadata-provided courseId to avoid cross-app fetch
    course_id = None
    try:
        meta = getattr(n, "metadata", None) or {}
        course_id = meta.get("courseId")
    except Exception:
        course_id = None
    return str(course_id) if course_id else None


def _serialize_notification(n: Notification) -> dict:
    # Actor payload (respect anonymous flag for forum)
    actor: dict | None = None
    if n.actor is not None:
        if getattr(n, "actor_is_anonymous", False) and n.actor_id != n.recipient_id:
            actor = {"id": "anonymous", "name": "Anonymous", "avatar": None}
        else:
            actor = _author_payload_for(n.actor)

    payload: dict = {
        "id": n.id,
        "type": n.type,
        "isRead": bool(n.is_read),
        "createdAt": n.created_at.isoformat(),
        "actor": actor,
        # Minimal target IDs for client routing (kept for compatibility; filled from metadata when possible)
        "forumPostId": (n.metadata or {}).get("forumPostId") if getattr(n, "metadata", None) else None,
        "forumPostCommentId": (n.metadata or {}).get("forumPostCommentId") if getattr(n, "metadata", None) else None,
        "courseReviewId": (n.metadata or {}).get("courseReviewId") if getattr(n, "metadata", None) else None,
        "courseReviewReplyId": (n.metadata or {}).get("courseReviewReplyId") if getattr(n, "metadata", None) else None,
        "courseId": _get_course_id_from_notification(n),
        # Content preview for better UX
        "contentPreview": getattr(n, "content_preview", "") or "",
        # Unified referenced content preview displayed by the client
        # Note: We only use the stored DB field and do not compute any fallback content here.
        "referencedContentPreview": getattr(n, "referenced_content_preview", "") or "Error: Cannot get preview",
    }
    # Optional titles for better UX from metadata only
    try:
        meta = getattr(n, "metadata", None) or {}
        if "forumPostTitle" in meta:
            payload["forumPostTitle"] = meta.get("forumPostTitle")
        if "courseTitle" in meta:
            payload["courseTitle"] = meta.get("courseTitle")
    except Exception:
        pass
    return payload


@api_view(["GET"])
def notifications_list(request):
    if not request.user.is_authenticated:
        return Response({"message": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    unread_only = request.query_params.get("unreadOnly") in {"1", "true", "True"}
    qs = (
        Notification.objects
        .select_related("actor")
        .filter(recipient=request.user, is_deleted=False)
        .order_by("-created_at", "-id")
    )
    if unread_only:
        qs = qs.filter(is_read=False)
    paginator = DefaultNotificationPageNumberPagination()
    page = paginator.paginate_queryset(qs, request)
    items = page or list(qs)
    data = [_serialize_notification(n) for n in items]
    if page is not None:
        return paginator.get_paginated_response(data)
    return Response(data)


@api_view(["GET"])
def notifications_unread_count(request):
    if not request.user.is_authenticated:
        return Response({"count": 0})
    cnt = Notification.objects.filter(recipient=request.user, is_read=False, is_deleted=False).count()
    return Response({"count": int(cnt)})


@api_view(["POST"])
def notifications_mark_read(request):
    if not request.user.is_authenticated:
        return Response({"message": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    nid = (request.data or {}).get("id")
    if not nid:
        return Response({"detail": "id is required"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        Notification.objects.filter(recipient=request.user, id=nid).update(is_read=True)
    except Exception:
        pass
    # publish new unread count
    unread = Notification.objects.filter(recipient=request.user, is_read=False, is_deleted=False).count()
    try:
        publish(str(request.user.pk), {"type": "notification", "unreadCount": int(unread)})
    except Exception:
        pass
    return Response({"success": True})


@api_view(["POST"])
def notifications_mark_all_read(request):
    if not request.user.is_authenticated:
        return Response({"message": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    Notification.objects.filter(recipient=request.user, is_read=False, is_deleted=False).update(is_read=True)
    try:
        publish(str(request.user.pk), {"type": "notification", "unreadCount": 0})
    except Exception:
        pass
    return Response({"success": True, "unread": 0})


@api_view(["POST"])
def notifications_delete_read(request):
    if not request.user.is_authenticated:
        return Response({"message": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    Notification.objects.filter(recipient=request.user, is_read=True, is_deleted=False).update(is_deleted=True)
    return Response({"success": True})


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def notifications_sse_status(request):
    """
    Returns SSE availability status.
    Clients should check this before attempting to open an SSE connection.
    """
    sse_enabled = getattr(settings, "NOTIFICATIONS_SSE_ENABLED", False)
    return Response({"sseEnabled": sse_enabled})


async def notifications_stream(request: HttpRequest):
    """
    Async SSE endpoint for real-time notifications.
    
    This view is designed to run under Uvicorn (ASGI) and uses:
    - Async Redis pub/sub (redis.asyncio) for non-blocking event streaming
    - Django's async ORM (.acount()) for database queries
    
    ARCHITECTURE NOTES:
    - This view runs directly on Uvicorn's event loop
    - No thread pool workers are consumed during the long-lived connection
    - A single Uvicorn worker can handle thousands of concurrent SSE connections
    - Database connections are only used briefly during initial query, then released
    - The streaming loop uses only Redis, which is also non-blocking
    """
    # 0. Check if SSE is enabled
    if not getattr(settings, "NOTIFICATIONS_SSE_ENABLED", False):
        return HttpResponse(
            "SSE is disabled on this server",
            status=503,
            content_type="text/plain"
        )

    # 1. Authentication check (must use sync_to_async for lazy user access)
    user = await sync_to_async(lambda: request.user)()
    if not user.is_authenticated:
        return HttpResponse("Unauthorized", status=401)
    
    user_pk = str(user.pk)

    # 2. Parse Last-Event-ID from header or query
    last_event_id = None
    hdr_last_id = request.headers.get("Last-Event-ID")
    q_last_id = request.GET.get("lastEventId")
    raw_last = hdr_last_id or q_last_id
    if raw_last:
        try:
            last_event_id = int(raw_last)
        except Exception:
            last_event_id = None

    # 3. Query unread count using async ORM (Django 4.1+). This briefly acquires a DB connection, queries, then releases it immediately
    cnt = await Notification.objects.filter(recipient=user, is_read=False, is_deleted=False).acount()

    # 4. Create async Redis subscriber
    sub = subscribe_async(user_pk, last_event_id=last_event_id)

    async def _gen():
        """
        Async generator that yields SSE events.
        - All middleware has finished
        - No database connections are held
        - We're purely streaming from Redis (non-blocking)
        """
        # Initial event with unread count
        yield f"data: {{\"type\": \"notification\", \"unreadCount\": {int(cnt)} }}\n\n"
        
        # Stream events from Redis (async, non-blocking)
        try:
            async for chunk in sub.listen(keepalive_seconds=int(getattr(settings, "NOTIFICATIONS_SSE_KEEPALIVE_SECONDS", 15))):
                yield chunk
        except asyncio.CancelledError:
            # Client disconnected - this is expected for sometime.
            logger.debug("SSE client disconnected: user_pk=%s", user_pk)  # use `logger.debug` to avoid too much logging
            pass
        finally:
            # Ensure Redis resources are cleaned up
            await sub.close()

    resp = StreamingHttpResponse(_gen(), content_type='text/event-stream')
    # discourage buffering/caching
    resp["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp["X-Accel-Buffering"] = "no"  # nginx
    return resp


