from django.shortcuts import render
from django.db.models import Q
import bleach
import re
from django.core.exceptions import ValidationError

# Create your views here.
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle
from courses.models import Course, CourseReview
from forum.models import ForumPost, ForumPostComment
from wiki.models import WikiPage
from teachers.models import Teacher
from accounts.models import Profile


def _get_author_name(user) -> str:
    """Get author display name, safely handling Profile access."""
    try:
        return user.profile.nickname
    except AttributeError:
        return user.get_username()


def _build_search_result(result_type: str, obj_id: str, title: str, snippet: str, url: str, metadata: dict) -> dict:
    """Helper function to build consistent search result objects."""
    return {
        'type': result_type,
        'id': str(obj_id),
        'title': title,
        'snippet': snippet,
        'url': url,
        'metadata': metadata
    }


def _truncate_content(content: str, max_length: int = 200) -> str:
    """Helper function to truncate content with ellipsis."""
    if len(content) <= max_length:
        return content
    return content[:max_length] + '...'


def _validate_and_sanitize_search_query(query: str) -> str:
    """
    Validate and sanitize search query to prevent security issues.
    
    Security measures:
    1. Strip HTML tags to prevent XSS
    2. Limit length to prevent DoS attacks
    3. Remove control characters
    4. Validate allowed characters
    
    Args:
        query: Raw search query from user input
        
    Returns:
        Sanitized and validated search query
        
    Raises:
        ValidationError: If query is invalid or potentially malicious
    """
    if not query:
        raise ValidationError("Search query cannot be empty")
    
    # Remove HTML tags completely (search queries should be plain text)
    sanitized = bleach.clean(
        query,
        tags=[],  # No HTML tags allowed in search
        attributes={},  # No attributes allowed
        protocols=[],  # No protocols needed
        strip=True  # Strip disallowed tags
    )
    
    # Strip whitespace
    sanitized = sanitized.strip()
    
    # Check minimum length after sanitization
    if not sanitized:
        raise ValidationError("Search query cannot be empty after sanitization")
    
    # Limit maximum length to prevent DoS attacks
    MAX_QUERY_LENGTH = 500  # Reasonable limit for search queries
    if len(sanitized) > MAX_QUERY_LENGTH:
        raise ValidationError(f"Search query too long (max {MAX_QUERY_LENGTH} characters)")
    
    # Remove control characters (but allow common punctuation and unicode)
    # Keep: letters, numbers, spaces, common punctuation, Chinese/Unicode characters
    sanitized = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', sanitized)
    
    # Check for suspicious patterns that might indicate injection attempts
    suspicious_patterns = [
        r'<script',  # Script tags
        r'javascript:',  # JavaScript URLs
        r'data:',  # Data URLs
        r'vbscript:',  # VBScript URLs
        r'onload=',  # Event handlers
        r'onerror=',  # Event handlers
        r'eval\(',  # Eval function calls
    ]
    
    query_lower = sanitized.lower()
    for pattern in suspicious_patterns:
        if re.search(pattern, query_lower):
            raise ValidationError("Search query contains potentially malicious content")
    
    # Final check: query should not be empty after all processing
    if not sanitized.strip():
        raise ValidationError("Search query invalid after security processing")
    
    return sanitized

@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})


class SearchRateThrottle(UserRateThrottle):
    """Custom throttle for search endpoint to prevent abuse."""
    scope = 'search'
    rate = '100/hour'  # Allow 100 searches per hour per user


class SearchAnonThrottle(AnonRateThrottle):
    """Custom throttle for anonymous search requests."""
    scope = 'search_anon'
    rate = '50/hour'  # Allow 50 searches per hour for anonymous users


@api_view(["GET"])
@throttle_classes([SearchRateThrottle, SearchAnonThrottle])
def search(request):
    """
    Global search endpoint supporting courses, forum posts, forum comments, 
    course reviews, wiki pages, teachers, and users.
    
    Query params:
    - q: search query (required)
    - page: page number (default: 1)
    - page_size: results per page (default: 20, max: 100)
    - types: comma-separated content types to filter
            (course,forum_post,forum_comment,course_review,wiki,teacher,user)
    """
    # Validate and sanitize search query
    raw_query = request.GET.get('q', '').strip()
    if not raw_query:
        return Response({
            "results": [],
            "total": 0,
            "page": 1,
            "page_size": 20
        })
    
    try:
        query = _validate_and_sanitize_search_query(raw_query)
    except ValidationError as e:
        return Response({
            "error": "Invalid search query",
            "details": str(e),
            "results": [],
            "total": 0,
            "page": 1,
            "page_size": 20
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Parse pagination params
    try:
        page = int(request.GET.get('page', 1))
        page = max(1, page)
    except (ValueError, TypeError):
        page = 1
    
    try:
        page_size = int(request.GET.get('page_size', 20))
        page_size = min(max(1, page_size), 100)  # Cap at 100
    except (ValueError, TypeError):
        page_size = 20
    
    # Parse type filters
    types_param = request.GET.get('types', '')
    allowed_types = {'course', 'forum_post', 'forum_comment', 'course_review', 'wiki', 'teacher', 'user'}
    if types_param:
        filter_types = set(t.strip() for t in types_param.split(',') if t.strip() in allowed_types)
    else:
        filter_types = allowed_types
    
    results = []
    
    # Search in Course
    if 'course' in filter_types:
        courses = Course.objects.filter(
            Q(subject_code__icontains=query) |
            Q(title__icontains=query) |
            Q(department__icontains=query)
        ).order_by('-last_updated')[:50]
        
        for course in courses:
            snippet = course.title
            if course.ai_summary:
                snippet = course.ai_summary[:200] + ('...' if len(course.ai_summary) > 200 else '')
            
            results.append({
                'type': 'course',
                'id': str(course.course_id),
                'title': f"{course.subject_code} {course.title}",
                'snippet': snippet,
                'url': f"/courses/{course.course_id}",
                'metadata': {
                    'subject_code': course.subject_code,
                    'department': course.department,
                    'rating': course.rating_score,
                    'created_at': course.last_updated.isoformat()
                }
            })
    
    # Search in ForumPost
    if 'forum_post' in filter_types:
        # Anonymous posts should NOT be searchable by author nickname
        posts = ForumPost.objects.filter(
            Q(title__icontains=query) |
            Q(content__icontains=query) |
            (Q(author__profile__nickname__icontains=query) & Q(is_anonymous=False))
        ).select_related('author', 'author__profile').order_by('-created_at')[:50]
        
        for post in posts:
            snippet = _truncate_content(post.content)
            metadata = {
                'author': _get_author_name(post.author) if not post.is_anonymous else '匿名',
                'created_at': post.created_at.isoformat(),
                'likes_count': post.likes_count
            }
            results.append(_build_search_result(
                'forum_post', post.id, post.title, snippet, f"/post/{post.id}", metadata
            ))
    
    # Search in ForumPostComment
    if 'forum_comment' in filter_types:
        # Anonymous comments should NOT be searchable by author nickname
        comments = ForumPostComment.objects.filter(
            Q(content__icontains=query) |
            (Q(author__profile__nickname__icontains=query) & Q(is_anonymous=False)),
            is_deleted=False
        ).select_related('post', 'author', 'author__profile').order_by('-created_at')[:50]
        
        for comment in comments:
            snippet = _truncate_content(comment.content)
            title = f"评论于：{comment.post.title}"
            metadata = {
                'parent_id': str(comment.post.id),
                'parent_title': comment.post.title,
                'author': _get_author_name(comment.author) if not comment.is_anonymous else '匿名',
                'created_at': comment.created_at.isoformat()
            }
            results.append(_build_search_result(
                'forum_comment', comment.id, title, snippet, 
                f"/post/{comment.post.id}#comment-{comment.id}", metadata
            ))
    
    # Search in CourseReview
    if 'course_review' in filter_types:
        # Anonymous reviews should NOT be searchable by author nickname
        reviews = CourseReview.objects.filter(
            Q(content__icontains=query) |
            (Q(author__profile__nickname__icontains=query) & Q(is_anonymous=False))
        ).select_related('course', 'author', 'author__profile').order_by('-created_at')[:50]
        
        for review in reviews:
            content_snippet = review.content[:200] + ('...' if len(review.content) > 200 else '')
            course_title = f"{review.course.subject_code} {review.course.title}"
            
            results.append({
                'type': 'course_review',
                'id': str(review.id),
                'title': f"点评于：{course_title}",
                'snippet': content_snippet,
                'url': f"/courses/{review.course.course_id}#review-{review.id}",
                'metadata': {
                    'parent_id': str(review.course.course_id),
                    'parent_title': course_title,
                    'author': _get_author_name(review.author) if not review.is_anonymous else '匿名',
                    'created_at': review.created_at.isoformat(),
                    'rating': review.overall_rating
                }
            })
    
    # Search in WikiPage
    if 'wiki' in filter_types:
        wiki_pages = WikiPage.objects.filter(
            Q(title__icontains=query) |
            Q(content__icontains=query) |
            Q(summary__icontains=query) |
            Q(tags__icontains=query) |
            Q(author__profile__nickname__icontains=query),
            status='published'
        ).select_related('author', 'author__profile').order_by('-updated_at')[:50]
        
        for wiki_page in wiki_pages:
            snippet = wiki_page.summary if wiki_page.summary else wiki_page.content[:200] + ('...' if len(wiki_page.content) > 200 else '')
            
            results.append({
                'type': 'wiki',
                'id': str(wiki_page.id),
                'title': wiki_page.title,
                'snippet': snippet,
                'url': f"/wiki/{wiki_page.slug}",
                'metadata': {
                    'author': _get_author_name(wiki_page.author),
                    'created_at': wiki_page.created_at.isoformat(),
                    'updated_at': wiki_page.updated_at.isoformat(),
                    'view_count': wiki_page.view_count
                }
            })
    
    # Search in Teacher
    if 'teacher' in filter_types:
        teachers = Teacher.objects.filter(
            Q(name__icontains=query) |
            Q(department__icontains=query) |
            Q(bio__icontains=query)
        ).order_by('-updated_at')[:50]
        
        for teacher in teachers:
            snippet = teacher.bio[:200] + ('...' if teacher.bio and len(teacher.bio) > 200 else '') if teacher.bio else f"{teacher.title} - {teacher.department}"
            
            results.append({
                'type': 'teacher',
                'id': str(teacher.id),
                'title': teacher.name,
                'snippet': snippet,
                'url': f"/teachers/{teacher.id}",
                'metadata': {
                    'title': teacher.title,
                    'department': teacher.department,
                    'rating': teacher.rating_overall,
                    'reviews_count': teacher.rating_reviews_count
                }
            })
    
    # Search in User/Profile
    if 'user' in filter_types:
        profiles = Profile.objects.filter(
            Q(nickname__icontains=query)
        ).select_related('user')[:50]
        
        for profile in profiles:
            # Count user's content
            from django.db.models import Count
            user = profile.user
            posts_count = user.forum_posts.count()
            reviews_count = user.course_reviews.count()
            
            snippet = f"帖子: {posts_count} | 课程点评: {reviews_count}"
            if profile.pronouns and profile.pronouns != 'not_specified':
                snippet = f"{profile.pronouns} | {snippet}"
            
            results.append({
                'type': 'user',
                'id': str(user.id),
                'title': profile.nickname,
                'snippet': snippet,
                'url': f"/user/{user.id}",
                'metadata': {
                    'nickname': profile.nickname,
                    'avatar_url': profile.avatar_url,
                    'posts_count': posts_count,
                    'reviews_count': reviews_count
                }
            })
    
    # Sort results by relevance (simple: prioritize title matches, then by date)
    def relevance_score(result):
        title_match = 1 if query.lower() in result['title'].lower() else 0
        return title_match
    
    results.sort(key=relevance_score, reverse=True)
    
    # Apply pagination
    total = len(results)
    start = (page - 1) * page_size
    end = start + page_size
    paginated_results = results[start:end]
    
    return Response({
        "results": paginated_results,
        "total": total,
        "page": page,
        "page_size": page_size
    })