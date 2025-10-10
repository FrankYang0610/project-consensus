from django.db.models import Q, F, Value, FloatField, Case, When
from django.contrib.postgres.search import TrigramSimilarity
from django.db.models.functions import Greatest, Coalesce, Substr, Least, Trim, NullIf
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
from django.db.models import Count


# ==================== Search Configuration Constants ====================
"""
Search scoring is based on a weighted combination of:
1. Text similarity (90%): Using PostgreSQL trigram similarity for multi-language support
2. Popularity metrics (10%): Based on likes, views, or review counts

This balance prioritizes relevance while giving a slight boost to popular content.
"""

# Similarity weights for scoring
SIMILARITY_WEIGHT = 0.9  # Weight for text similarity in final score
POPULARITY_WEIGHT = 0.1  # Weight for popularity metrics in final score

# Type-specific similarity weights (for weighted combinations)
FORUM_POST_WEIGHTS = {
    'title': 0.6,      # Title is most important for posts
    'content': 0.35,   # Content is secondary
    'author': 0.05     # Author match is least important
}

# Similarity thresholds based on query length
# Shorter queries need higher thresholds to reduce false positives
SIMILARITY_THRESHOLDS = {
    'very_short': 0.30,  # 1 character queries - strictest
    'short': 0.15,       # 2 character queries - moderate
    'normal': 0.1        # 3+ character queries - most permissive
}

# Query length boundaries
QUERY_LENGTH_VERY_SHORT = 1
QUERY_LENGTH_SHORT = 2

# Popularity normalization divisors
# These values normalize popularity metrics to [0, 1] range
POPULARITY_DIVISORS = {
    'reviews': 100.0,        # 100+ reviews = max popularity
    'likes': 100.0,          # 100+ likes = max popularity
    'views': 1000.0,         # 1000+ views = max popularity
    'user_activity': 100.0   # 100+ posts/reviews = max popularity
}

# Result limits
MAX_RESULTS_PER_TYPE = 60    # Maximum results per content type
MAX_PAGE_SIZE = 100          # Maximum results per page
DEFAULT_PAGE_SIZE = 20       # Default results per page

# Search query validation
MAX_QUERY_LENGTH = 500       # Maximum characters in search query


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


def _get_similarity_threshold(query_length: int) -> tuple[float, bool]:
    """
    Get appropriate similarity threshold and short query flag based on query length.
    
    Args:
        query_length: Length of the search query
        
    Returns:
        Tuple of (threshold, is_short_query)
    """
    if query_length <= QUERY_LENGTH_VERY_SHORT:
        return SIMILARITY_THRESHOLDS['very_short'], True
    elif query_length == QUERY_LENGTH_SHORT:
        return SIMILARITY_THRESHOLDS['short'], True
    else:
        return SIMILARITY_THRESHOLDS['normal'], False


def _create_popularity_norm(field_name: str, divisor_key: str):
    """
    Create a popularity normalization expression.
    
    Args:
        field_name: Name of the popularity field (e.g., 'likes_count')
        divisor_key: Key in POPULARITY_DIVISORS dict
        
    Returns:
        Django ORM expression for normalized popularity [0, 1]
    """
    divisor = POPULARITY_DIVISORS.get(divisor_key, 100.0)
    return Least(F(field_name) / Value(divisor), Value(1.0))


def _create_final_score_expr():
    """
    Create the final score expression combining similarity and popularity.
    
    Returns:
        Django ORM expression for final score
    """
    return F('similarity') * Value(SIMILARITY_WEIGHT) + F('popularity_norm') * Value(POPULARITY_WEIGHT)


def _create_snippet_expr(primary_field: str, fallback_field: str = None, max_length: int = 200):
    """
    Create a snippet extraction expression.
    
    Args:
        primary_field: Primary field to extract snippet from
        fallback_field: Optional fallback field if primary is empty
        max_length: Maximum snippet length
        
    Returns:
        Django ORM expression for snippet
    """
    primary = NullIf(Trim(Substr(primary_field, 1, max_length)), Value(''))
    
    if fallback_field:
        return Coalesce(primary, Substr(fallback_field, 1, max_length), Value(''))
    else:
        return Coalesce(primary, Value(''))


def _apply_short_query_filters(queryset, query: str, similarity_threshold: float, 
                                prefix_fields: list, text_fields: list):
    """
    Apply filters for short queries with prefix and text fallbacks.
    
    Args:
        queryset: Django queryset to filter
        query: Search query string
        similarity_threshold: Minimum similarity threshold
        prefix_fields: List of field names for prefix matching
        text_fields: List of field names for text contains matching
        
    Returns:
        Filtered queryset
    """
    # Build prefix filter (istartswith)
    prefix_q = Q()
    for field in prefix_fields:
        prefix_q |= Q(**{f'{field}__istartswith': query})
    
    # Build text fallback filter (icontains)
    text_q = Q()
    for field in text_fields:
        text_q |= Q(**{f'{field}__icontains': query})
    
    # Combine: similarity OR prefix OR text
    return queryset.filter(
        Q(similarity__gte=similarity_threshold) | prefix_q | text_q
    )


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


def _search_courses(query: str, similarity_threshold: float, is_short_query: bool) -> list:
    """
    Search in Course model using trigram similarity.
    
    Searches across: subject_code, title, department
    Snippet: ai_summary or title
    Popularity: based on review count
    """
    courses_qs = Course.objects.annotate(
        similarity=Greatest(
            Coalesce(TrigramSimilarity('subject_code', query), Value(0.0)),
            Coalesce(TrigramSimilarity('title', query), Value(0.0)),
            Coalesce(TrigramSimilarity('department', query), Value(0.0))
        ),
        snippet=_create_snippet_expr('ai_summary', 'title'),
        popularity_norm=_create_popularity_norm('rating_reviews_count', 'reviews'),
    ).annotate(
        final_score=_create_final_score_expr()
    )

    # Apply filters
    if is_short_query:
        courses_qs = _apply_short_query_filters(
            courses_qs, query, similarity_threshold,
            prefix_fields=['subject_code', 'title', 'department'],
            text_fields=['subject_code', 'title', 'department']
        )
    else:
        courses_qs = courses_qs.filter(similarity__gte=similarity_threshold)

    # Optimize field loading and ordering
    courses = courses_qs.only(
        'course_id', 'subject_code', 'title', 'ai_summary', 'department', 
        'rating_score', 'last_updated', 'rating_reviews_count'
    ).order_by('-final_score', '-last_updated')[:MAX_RESULTS_PER_TYPE]
    
    results = []
    for course in courses:
        snippet = course.snippet or ''
        results.append({
            **_build_search_result(
                'course', course.course_id, f"{course.subject_code} {course.title}", 
                snippet, f"/courses/{course.course_id}",
                {
                    'subject_code': course.subject_code,
                    'department': course.department,
                    'rating': course.rating_score,
                    'created_at': course.last_updated.isoformat()
                }
            ),
            'score': float(course.final_score)
        })
    return results


def _search_forum_posts(query: str, similarity_threshold: float, is_short_query: bool) -> list:
    """
    Search in ForumPost model using trigram similarity.
    
    Searches across: title, content, author nickname
    Weighted: title (60%), content (35%), author (5%)
    Snippet: post content
    Popularity: based on likes count
    """
    posts_qs = ForumPost.objects.annotate(
        title_sim=Coalesce(TrigramSimilarity('title', query), Value(0.0)),
        content_sim=Coalesce(TrigramSimilarity('content', query), Value(0.0)),
        author_sim=Case(
            When(is_anonymous=True, then=Value(0.0)),
            default=Coalesce(TrigramSimilarity('author__profile__nickname', query), Value(0.0)),
            output_field=FloatField()
        ),
        snippet=Coalesce(Substr('content', 1, 200), Value('')),
    ).annotate(
        similarity=(
            F('title_sim') * Value(FORUM_POST_WEIGHTS['title']) + 
            F('content_sim') * Value(FORUM_POST_WEIGHTS['content']) + 
            F('author_sim') * Value(FORUM_POST_WEIGHTS['author'])
        ),
        popularity_norm=_create_popularity_norm('likes_count', 'likes'),
        final_score=_create_final_score_expr()
    )

    if is_short_query:
        posts_qs = _apply_short_query_filters(
            posts_qs, query, similarity_threshold,
            prefix_fields=['title', 'author__profile__nickname'],
            text_fields=['title', 'content', 'author__profile__nickname']
        )
    else:
        posts_qs = posts_qs.filter(similarity__gte=similarity_threshold)

    posts = posts_qs.select_related('author', 'author__profile').defer(
        'content'
    ).order_by('-final_score', '-created_at')[:MAX_RESULTS_PER_TYPE]
    
    results = []
    for post in posts:
        snippet = post.snippet or ''
        metadata = {
            'author': _get_author_name(post.author) if not post.is_anonymous else 'Anonymous',
            'created_at': post.created_at.isoformat(),
            'likes_count': post.likes_count
        }
        results.append({
            **_build_search_result(
                'forum_post', post.id, post.title, snippet, f"/post/{post.id}", metadata
            ),
            'score': float(post.final_score)
        })
    return results


def _search_forum_comments(query: str, similarity_threshold: float, is_short_query: bool) -> list:
    """
    Search in ForumPostComment model using trigram similarity.
    
    Searches across: content, author nickname
    Snippet: comment content
    Popularity: based on likes count
    """
    comments_qs = ForumPostComment.objects.annotate(
        content_sim=Coalesce(TrigramSimilarity('content', query), Value(0.0)),
        author_sim=Case(
            When(is_anonymous=True, then=Value(0.0)),
            default=Coalesce(TrigramSimilarity('author__profile__nickname', query), Value(0.0)),
            output_field=FloatField()
        ),
        snippet=_create_snippet_expr('content'),
    ).annotate(
        similarity=Greatest(F('content_sim'), F('author_sim')),
        popularity_norm=_create_popularity_norm('likes_count', 'likes'),
        final_score=_create_final_score_expr()
    ).filter(is_deleted=False)

    if is_short_query:
        comments_qs = _apply_short_query_filters(
            comments_qs, query, similarity_threshold,
            prefix_fields=['author__profile__nickname', 'post__title'],
            text_fields=['content', 'author__profile__nickname', 'post__title']
        )
    else:
        comments_qs = comments_qs.filter(similarity__gte=similarity_threshold)

    comments = comments_qs.select_related('post', 'author', 'author__profile').defer(
        'content'
    ).order_by('-final_score', '-created_at')[:MAX_RESULTS_PER_TYPE]
    
    results = []
    for comment in comments:
        snippet = comment.snippet or ''
        metadata = {
            'parent_id': str(comment.post.id),
            'parent_title': comment.post.title,
            'author': _get_author_name(comment.author) if not comment.is_anonymous else 'Anonymous',
            'created_at': comment.created_at.isoformat(),
            'title_template': 'commentOn',
        }
        results.append({
            **_build_search_result(
                'forum_comment', comment.id, comment.post.title, snippet, 
                f"/post/{comment.post.id}#comment-{comment.id}", metadata
            ),
            'score': float(comment.final_score)
        })
    return results


def _search_course_reviews(query: str, similarity_threshold: float, is_short_query: bool) -> list:
    """
    Search in CourseReview model using trigram similarity.
    
    Searches across: content, author nickname
    Snippet: review content
    Popularity: based on likes count
    """
    reviews_qs = CourseReview.objects.annotate(
        content_sim=Coalesce(TrigramSimilarity('content', query), Value(0.0)),
        author_sim=Case(
            When(is_anonymous=True, then=Value(0.0)),
            default=Coalesce(TrigramSimilarity('author__profile__nickname', query), Value(0.0)),
            output_field=FloatField()
        ),
        snippet=_create_snippet_expr('content'),
    ).annotate(
        similarity=Greatest(F('content_sim'), F('author_sim')),
        popularity_norm=_create_popularity_norm('likes_count', 'likes'),
        final_score=_create_final_score_expr()
    )

    if is_short_query:
        reviews_qs = _apply_short_query_filters(
            reviews_qs, query, similarity_threshold,
            prefix_fields=['author__profile__nickname'],
            text_fields=['content', 'author__profile__nickname']
        )
    else:
        reviews_qs = reviews_qs.filter(similarity__gte=similarity_threshold)

    reviews = reviews_qs.select_related('course', 'author', 'author__profile').defer(
        'content'
    ).order_by('-final_score', '-created_at')[:MAX_RESULTS_PER_TYPE]
    
    results = []
    for review in reviews:
        content_snippet = review.snippet or ''
        course_title = f"{review.course.subject_code} {review.course.title}"
        
        results.append({
            **_build_search_result(
                'course_review', review.id, course_title, content_snippet,
                f"/courses/{review.course.course_id}#review-{review.id}",
                {
                    'parent_id': str(review.course.course_id),
                    'parent_title': course_title,
                    'author': _get_author_name(review.author) if not review.is_anonymous else 'Anonymous',
                    'created_at': review.created_at.isoformat(),
                    'rating': review.overall_rating,
                    'title_template': 'reviewOn',
                }
            ),
            'score': float(review.final_score)
        })
    return results


def _search_wiki_pages(query: str, similarity_threshold: float, is_short_query: bool) -> list:
    """
    Search in WikiPage model using trigram similarity.
    
    Searches across: title, content, summary, tags, author nickname
    Snippet: summary or content
    Popularity: based on view count
    Only returns published pages
    """
    wiki_qs = WikiPage.objects.annotate(
        similarity=Greatest(
            Coalesce(TrigramSimilarity('title', query), Value(0.0)),
            Coalesce(TrigramSimilarity('content', query), Value(0.0)),
            Coalesce(TrigramSimilarity('summary', query), Value(0.0)),
            Coalesce(TrigramSimilarity('tags', query), Value(0.0)),
            Coalesce(TrigramSimilarity('author__profile__nickname', query), Value(0.0))
        ),
        snippet=_create_snippet_expr('summary', 'content'),
    ).annotate(
        popularity_norm=_create_popularity_norm('view_count', 'views'),
        final_score=_create_final_score_expr()
    ).filter(status='published')

    if is_short_query:
        wiki_qs = _apply_short_query_filters(
            wiki_qs, query, similarity_threshold,
            prefix_fields=['title', 'tags', 'author__profile__nickname'],
            text_fields=['title', 'content', 'summary', 'tags', 'author__profile__nickname']
        )
    else:
        wiki_qs = wiki_qs.filter(similarity__gte=similarity_threshold)

    wiki_pages = wiki_qs.select_related('author', 'author__profile').defer(
        'content'
    ).order_by('-final_score', '-updated_at')[:MAX_RESULTS_PER_TYPE]
    
    results = []
    for wiki_page in wiki_pages:
        snippet = wiki_page.snippet or ''
        
        results.append({
            **_build_search_result(
                'wiki', wiki_page.id, wiki_page.title, snippet, f"/wiki/{wiki_page.slug}",
                {
                    'author': _get_author_name(wiki_page.author),
                    'created_at': wiki_page.created_at.isoformat(),
                    'updated_at': wiki_page.updated_at.isoformat(),
                    'view_count': wiki_page.view_count
                }
            ),
            'score': float(wiki_page.final_score)
        })
    return results


def _search_teachers(query: str, similarity_threshold: float, is_short_query: bool) -> list:
    """
    Search in Teacher model using trigram similarity.
    
    Searches across: name, department, bio
    Snippet: bio or title-department combination
    Popularity: based on review count
    """
    teachers_qs = Teacher.objects.annotate(
        similarity=Greatest(
            Coalesce(TrigramSimilarity('name', query), Value(0.0)),
            Coalesce(TrigramSimilarity('department', query), Value(0.0)),
            Coalesce(TrigramSimilarity('bio', query), Value(0.0))
        ),
        snippet=_create_snippet_expr('bio'),
    ).annotate(
        popularity_norm=_create_popularity_norm('rating_reviews_count', 'reviews'),
        final_score=_create_final_score_expr()
    )

    if is_short_query:
        teachers_qs = _apply_short_query_filters(
            teachers_qs, query, similarity_threshold,
            prefix_fields=['name', 'department'],
            text_fields=['name', 'department', 'bio']
        )
    else:
        teachers_qs = teachers_qs.filter(similarity__gte=similarity_threshold)

    teachers = teachers_qs.order_by('-final_score', '-updated_at')[:MAX_RESULTS_PER_TYPE]
    
    results = []
    for teacher in teachers:
        snippet = teacher.snippet or (
            f"{teacher.title} - {teacher.department}" if teacher.title or teacher.department else ''
        )
        
        results.append({
            **_build_search_result(
                'teacher', teacher.id, teacher.name, snippet, f"/teachers/{teacher.id}",
                {
                    'title': teacher.title,
                    'department': teacher.department,
                    'rating': teacher.rating_overall,
                    'reviews_count': teacher.rating_reviews_count
                }
            ),
            'score': float(teacher.final_score)
        })
    return results


def _search_users(query: str, similarity_threshold: float, is_short_query: bool) -> list:
    """
    Search in User/Profile model using trigram similarity.
    
    Searches across: nickname
    Snippet: user pronouns
    Popularity: based on combined posts and reviews count
    """
    profiles_qs = Profile.objects.annotate(
        similarity=Coalesce(TrigramSimilarity('nickname', query), Value(0.0))
    )

    if is_short_query:
        profiles_qs = _apply_short_query_filters(
            profiles_qs, query, similarity_threshold,
            prefix_fields=['nickname'],
            text_fields=['nickname']
        )
    else:
        profiles_qs = profiles_qs.filter(similarity__gte=similarity_threshold)

    # Calculate user activity and final score
    profiles = profiles_qs.select_related('user').annotate(
        posts_count=Count('user__forum_posts', distinct=True),
        reviews_count=Count('user__course_reviews', distinct=True)
    ).annotate(
        activity_score=F('posts_count') + F('reviews_count'),
        popularity_norm=Least(F('activity_score') / Value(POPULARITY_DIVISORS['user_activity']), Value(1.0)),
        final_score=_create_final_score_expr()
    ).order_by('-final_score')[:MAX_RESULTS_PER_TYPE]
    
    results = []
    for profile in profiles:
        user = profile.user
        
        # Build snippet with pronouns if available
        snippet_parts = []
        if profile.pronouns and profile.pronouns != 'not_specified':
            snippet_parts.append(profile.pronouns)
        
        results.append({
            **_build_search_result(
                'user', user.id, profile.nickname, 
                ' | '.join(snippet_parts) if snippet_parts else '', 
                f"/user/{user.id}",
                {
                    'nickname': profile.nickname,
                    'avatar_url': profile.avatar_url,
                    'posts_count': profile.posts_count,
                    'reviews_count': profile.reviews_count,
                    'pronouns': profile.pronouns if profile.pronouns != 'not_specified' else None
                }
            ),
            'score': float(profile.final_score)
        })
    return results


@api_view(["GET"])
@throttle_classes([SearchRateThrottle, SearchAnonThrottle])
def search(request):
    """
    Global search endpoint using PostgreSQL trigram similarity for better Chinese text search.
    
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
            "page_size": DEFAULT_PAGE_SIZE
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
            "page_size": DEFAULT_PAGE_SIZE
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Parse pagination params
    try:
        page = int(request.GET.get('page', 1))
        page = max(1, page)
    except (ValueError, TypeError):
        page = 1
    
    try:
        page_size = int(request.GET.get('page_size', DEFAULT_PAGE_SIZE))
        page_size = min(max(1, page_size), MAX_PAGE_SIZE)
    except (ValueError, TypeError):
        page_size = DEFAULT_PAGE_SIZE
    
    # Parse type filters
    types_param = request.GET.get('types', '')
    allowed_types = {'course', 'forum_post', 'forum_comment', 'course_review', 'wiki', 'teacher', 'user'}
    if types_param:
        filter_types = set(t.strip() for t in types_param.split(',') if t.strip() in allowed_types)
    else:
        filter_types = allowed_types
    
    # Get similarity threshold based on query length
    similarity_threshold, is_short_query = _get_similarity_threshold(len(query))
    
    results = []
    
    # Search in each enabled content type using dedicated functions
    if 'course' in filter_types:
        results.extend(_search_courses(query, similarity_threshold, is_short_query))
    
    if 'forum_post' in filter_types:
        results.extend(_search_forum_posts(query, similarity_threshold, is_short_query))
    
    if 'forum_comment' in filter_types:
        results.extend(_search_forum_comments(query, similarity_threshold, is_short_query))
    
    if 'course_review' in filter_types:
        results.extend(_search_course_reviews(query, similarity_threshold, is_short_query))
    
    if 'wiki' in filter_types:
        results.extend(_search_wiki_pages(query, similarity_threshold, is_short_query))
    
    if 'teacher' in filter_types:
        results.extend(_search_teachers(query, similarity_threshold, is_short_query))
    
    if 'user' in filter_types:
        results.extend(_search_users(query, similarity_threshold, is_short_query))
    
    # Sort all results by score
    results.sort(key=lambda x: x.get('score', 0), reverse=True)
    
    # Remove internal metrics from final results
    for result in results:
        result.pop('similarity', None)
        result.pop('score', None)
    
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