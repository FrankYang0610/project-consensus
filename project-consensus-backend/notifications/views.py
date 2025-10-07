from __future__ import annotations

from django.http import StreamingHttpResponse, HttpRequest
from rest_framework.decorators import api_view, permission_classes
from rest_framework import status, permissions
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

# Reuse Notification model from accounts to avoid DB migrations during decoupling
from .models import Notification
from .runtime import subscribe, publish


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
    # Case 1: Direct course review notification
    if n.coursereview_id and hasattr(n, 'coursereview') and n.coursereview:
        try:
            course = getattr(n.coursereview, 'course', None)
            if course:
                return str(course.course_id)
        except (AttributeError, TypeError):
            pass
    # Case 2: Course review reply notification
    if n.coursereviewreply_id and hasattr(n, 'coursereviewreply') and n.coursereviewreply:
        try:
            review = getattr(n.coursereviewreply, 'review', None)
            if review:
                course = getattr(review, 'course', None)
                if course:
                    return str(course.course_id)
        except (AttributeError, TypeError):
            pass
    return None


def _serialize_notification(n: Notification) -> dict:
    # Actor payload (respect anonymous flag for forum)
    actor: dict | None = None
    if n.actor is not None:
        if getattr(n, "actor_is_anonymous", False) and n.actor_id != n.user_id:
            actor = {"id": "anonymous", "name": "Anonymous", "avatar": None}
        else:
            actor = _author_payload_for(n.actor)

    payload: dict = {
        "id": n.id,
        "type": n.type,
        "isRead": bool(n.is_read),
        "createdAt": n.created_at.isoformat(),
        "actor": actor,
        # Minimal target IDs for client routing
        "forumPostId": str(n.forumpost_id) if n.forumpost_id else None,
        "forumPostCommentId": str(n.forumpostcomment_id) if n.forumpostcomment_id else None,
        "courseReviewId": str(n.coursereview_id) if n.coursereview_id else None,
        "courseReviewReplyId": str(n.coursereviewreply_id) if n.coursereviewreply_id else None,
        "courseId": _get_course_id_from_notification(n),
        # Content preview for better UX
        "contentPreview": getattr(n, "content_preview", "") or "",
        # Unified referenced content preview displayed by the client
        # Note: We only use the stored DB field and do not compute any fallback content here.
        "referencedContentPreview": getattr(n, "referenced_content_preview", "") or "Error: Cannot get preview",
    }
    # Optional titles for better UX
    try:
        if n.forumpost_id and getattr(n, "forumpost", None) is not None:
            payload["forumPostTitle"] = n.forumpost.title
    except Exception:
        pass
    try:
        if n.coursereview_id and getattr(n.coursereview, "course", None) is not None:
            payload["courseTitle"] = n.coursereview.course.title
        elif n.coursereviewreply_id and getattr(n.coursereviewreply, "review", None) is not None and getattr(n.coursereviewreply.review, "course", None) is not None:
            payload["courseTitle"] = n.coursereviewreply.review.course.title
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
        .select_related(
            "actor",
            "forumpost",
            "forumpostcomment",
            "forumpostcomment__reply_to",
            "coursereview",
            "coursereview__course",
            "coursereviewreply",
            "coursereviewreply__review",
            "coursereviewreply__review__course",
        )
        .filter(user=request.user, is_deleted=False)
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
    cnt = Notification.objects.filter(user=request.user, is_read=False, is_deleted=False).count()
    return Response({"count": int(cnt)})


@api_view(["POST"])
def notifications_mark_read(request):
    if not request.user.is_authenticated:
        return Response({"message": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    nid = (request.data or {}).get("id")
    if not nid:
        return Response({"detail": "id is required"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        Notification.objects.filter(user=request.user, id=nid).update(is_read=True)
    except Exception:
        pass
    # publish new unread count
    unread = Notification.objects.filter(user=request.user, is_read=False, is_deleted=False).count()
    try:
        publish(str(request.user.pk), {"type": "notification", "unreadCount": int(unread)})
    except Exception:
        pass
    return Response({"success": True})


@api_view(["POST"])
def notifications_mark_all_read(request):
    if not request.user.is_authenticated:
        return Response({"message": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    Notification.objects.filter(user=request.user, is_read=False, is_deleted=False).update(is_read=True)
    try:
        publish(str(request.user.pk), {"type": "notification", "unreadCount": 0})
    except Exception:
        pass
    return Response({"success": True, "unread": 0})


@api_view(["POST"])
def notifications_delete_read(request):
    if not request.user.is_authenticated:
        return Response({"message": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    Notification.objects.filter(user=request.user, is_read=True, is_deleted=False).update(is_deleted=True)
    return Response({"success": True})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def notifications_stream(request: HttpRequest):
    user = request.user
    # Streaming response for SSE
    sub = subscribe(str(user.pk))

    def _gen():
        # initial event
        cnt = Notification.objects.filter(user=user, is_read=False, is_deleted=False).count()
        yield f"data: {{\"type\": \"notification\", \"unreadCount\": {int(cnt)} }}\n\n"
        # subsequent events
        for chunk in sub.listen():
            yield chunk

    resp = StreamingHttpResponse(_gen(), content_type='text/event-stream')
    # discourage buffering/caching
    resp["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp["X-Accel-Buffering"] = "no"  # nginx
    return resp


