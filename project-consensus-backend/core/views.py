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
    
    # Similarity threshold tuned by query length
    # Long queries keep lower threshold; very short queries raise threshold to reduce noise.
    # For 1-char queries, be stricter; for 2-char queries, slightly higher than default.
    qlen = len(query)
    if qlen <= 1:
        SIMILARITY_THRESHOLD = 0.30
        is_short_query = True
    elif qlen == 2:
        SIMILARITY_THRESHOLD = 0.15
        is_short_query = True
    else:
        SIMILARITY_THRESHOLD = 0.1
        is_short_query = False
    
    results = []
    
    # Search in Course using trigram similarity
    if 'course' in filter_types:
        courses_qs = Course.objects.annotate(
            similarity=Greatest(
                Coalesce(TrigramSimilarity('subject_code', query), Value(0.0)),
                Coalesce(TrigramSimilarity('title', query), Value(0.0)),
                Coalesce(TrigramSimilarity('department', query), Value(0.0))
            ),
            # DB-side snippet generation
            snippet=Coalesce(
                NullIf(Trim(Substr('ai_summary', 1, 200)), Value('')),
                Substr('title', 1, 200),
                Value('')
            ),
            # Popularity normalization (clipped to [0,1])
            popularity_norm=Least(F('rating_reviews_count') / Value(100.0), Value(1.0)),
        ).annotate(
            final_score=F('similarity') * Value(0.9) + F('popularity_norm') * Value(0.1)
        )

        # Short-query prefix fallback
        if is_short_query:
            prefix_filter = (
                Q(subject_code__istartswith=query) |
                Q(title__istartswith=query) |
                Q(department__istartswith=query)
            )
            text_fallback = (
                Q(subject_code__icontains=query) |
                Q(title__icontains=query) |
                Q(department__icontains=query)
            )
            courses_qs = courses_qs.filter(
                Q(similarity__gte=SIMILARITY_THRESHOLD) | prefix_filter | text_fallback
            )
        else:
            courses_qs = courses_qs.filter(similarity__gte=SIMILARITY_THRESHOLD)

        courses = courses_qs.only(
            'course_id', 'subject_code', 'title', 'ai_summary', 'department', 'rating_score', 'last_updated', 'rating_reviews_count'
        ).order_by('-final_score', '-last_updated')[:60]
        
        for course in courses:
            snippet = course.snippet or ''
            results.append({
                **_build_search_result(
                    'course', course.course_id, f"{course.subject_code} {course.title}", snippet, f"/courses/{course.course_id}",
                    {
                        'subject_code': course.subject_code,
                        'department': course.department,
                        'rating': course.rating_score,
                        'created_at': course.last_updated.isoformat()
                    }
                ),
                'score': float(getattr(course, 'final_score', getattr(course, 'similarity', 0.0)))
            })
    
    # Search in ForumPost using trigram similarity
    if 'forum_post' in filter_types:
        # Compute trigram similarity for title, content, and author nickname
        posts_qs = ForumPost.objects.annotate(
            title_sim=Coalesce(TrigramSimilarity('title', query), Value(0.0)),
            content_sim=Coalesce(TrigramSimilarity('content', query), Value(0.0)),
            # For anonymous posts, author similarity is 0
            author_sim=Case(
                When(is_anonymous=True, then=Value(0.0)),
                default=Coalesce(TrigramSimilarity('author__profile__nickname', query), Value(0.0)),
                output_field=FloatField()
            ),
            # DB-side snippet
            snippet=Coalesce(Substr('content', 1, 200), Value('')),
        ).annotate(
            # Weighted similarity instead of Greatest
            similarity=F('title_sim') * Value(0.6) + F('content_sim') * Value(0.35) + F('author_sim') * Value(0.05),
            # Popularity boost (likes_count)
            popularity_norm=Least(F('likes_count') / Value(100.0), Value(1.0)),
            final_score=F('similarity') * Value(0.9) + F('popularity_norm') * Value(0.1)
        )

        if is_short_query:
            prefix_filter = Q(title__istartswith=query) | Q(author__profile__nickname__istartswith=query)
            text_fallback = Q(title__icontains=query) | Q(content__icontains=query) | Q(author__profile__nickname__icontains=query)
            posts_qs = posts_qs.filter(Q(similarity__gte=SIMILARITY_THRESHOLD) | prefix_filter | text_fallback)
        else:
            posts_qs = posts_qs.filter(similarity__gte=SIMILARITY_THRESHOLD)

        posts = posts_qs.select_related('author', 'author__profile').defer('content').order_by('-final_score', '-created_at')[:60]
        
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
                'score': float(getattr(post, 'final_score', getattr(post, 'similarity', 0.0)))
            })
    
    # Search in ForumPostComment using trigram similarity
    if 'forum_comment' in filter_types:
        comments_qs = ForumPostComment.objects.annotate(
            content_sim=Coalesce(TrigramSimilarity('content', query), Value(0.0)),
            author_sim=Case(
                When(is_anonymous=True, then=Value(0.0)),
                default=Coalesce(TrigramSimilarity('author__profile__nickname', query), Value(0.0)),
                output_field=FloatField()
            ),
            snippet=Coalesce(NullIf(Trim(Substr('content', 1, 200)), Value('')), Value('')),
        ).annotate(
            similarity=Greatest(F('content_sim'), F('author_sim')),
            popularity_norm=Least(F('likes_count') / Value(100.0), Value(1.0)),
            final_score=F('similarity') * Value(0.9) + F('popularity_norm') * Value(0.1)
        ).filter(
            is_deleted=False
        )

        if is_short_query:
            prefix_filter = Q(author__profile__nickname__istartswith=query) | Q(post__title__istartswith=query)
            text_fallback = Q(content__icontains=query) | Q(author__profile__nickname__icontains=query) | Q(post__title__icontains=query)
            comments_qs = comments_qs.filter(Q(similarity__gte=SIMILARITY_THRESHOLD) | prefix_filter | text_fallback)
        else:
            comments_qs = comments_qs.filter(similarity__gte=SIMILARITY_THRESHOLD)

        comments = comments_qs.select_related('post', 'author', 'author__profile').defer('content').order_by('-final_score', '-created_at')[:60]
        
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
                'score': float(getattr(comment, 'final_score', getattr(comment, 'similarity', 0.0)))
            })
    
    # Search in CourseReview using trigram similarity
    if 'course_review' in filter_types:
        reviews_qs = CourseReview.objects.annotate(
            content_sim=Coalesce(TrigramSimilarity('content', query), Value(0.0)),
            author_sim=Case(
                When(is_anonymous=True, then=Value(0.0)),
                default=Coalesce(TrigramSimilarity('author__profile__nickname', query), Value(0.0)),
                output_field=FloatField()
            ),
            snippet=Coalesce(NullIf(Trim(Substr('content', 1, 200)), Value('')), Value('')),
        ).annotate(
            similarity=Greatest(F('content_sim'), F('author_sim')),
            popularity_norm=Least(F('likes_count') / Value(100.0), Value(1.0)),
            final_score=F('similarity') * Value(0.9) + F('popularity_norm') * Value(0.1)
        )

        if is_short_query:
            prefix_filter = Q(author__profile__nickname__istartswith=query)
            text_fallback = Q(content__icontains=query) | Q(author__profile__nickname__icontains=query)
            reviews_qs = reviews_qs.filter(Q(similarity__gte=SIMILARITY_THRESHOLD) | prefix_filter | text_fallback)
        else:
            reviews_qs = reviews_qs.filter(similarity__gte=SIMILARITY_THRESHOLD)

        reviews = reviews_qs.select_related('course', 'author', 'author__profile').defer('content').order_by('-final_score', '-created_at')[:60]
        
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
                'score': float(getattr(review, 'final_score', getattr(review, 'similarity', 0.0)))
            })
    
    # Search in WikiPage using trigram similarity
    if 'wiki' in filter_types:
        wiki_qs = WikiPage.objects.annotate(
            similarity=Greatest(
                Coalesce(TrigramSimilarity('title', query), Value(0.0)),
                Coalesce(TrigramSimilarity('content', query), Value(0.0)),
                Coalesce(TrigramSimilarity('summary', query), Value(0.0)),
                Coalesce(TrigramSimilarity('tags', query), Value(0.0)),
                Coalesce(TrigramSimilarity('author__profile__nickname', query), Value(0.0))
            ),
            snippet=Coalesce(
                NullIf(Trim(Substr('summary', 1, 200)), Value('')),
                Substr('content', 1, 200),
                Value('')
            ),
        ).annotate(
            popularity_norm=Least(F('view_count') / Value(1000.0), Value(1.0)),
            final_score=F('similarity') * Value(0.9) + F('popularity_norm') * Value(0.1)
        ).filter(
            status='published'
        )

        if is_short_query:
            prefix_filter = Q(title__istartswith=query) | Q(tags__istartswith=query) | Q(author__profile__nickname__istartswith=query)
            text_fallback = Q(title__icontains=query) | Q(content__icontains=query) | Q(summary__icontains=query) | Q(tags__icontains=query) | Q(author__profile__nickname__icontains=query)
            wiki_qs = wiki_qs.filter(Q(similarity__gte=SIMILARITY_THRESHOLD) | prefix_filter | text_fallback)
        else:
            wiki_qs = wiki_qs.filter(similarity__gte=SIMILARITY_THRESHOLD)

        wiki_pages = wiki_qs.select_related('author', 'author__profile').defer('content').order_by('-final_score', '-updated_at')[:60]
        
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
                'score': float(getattr(wiki_page, 'final_score', getattr(wiki_page, 'similarity', 0.0)))
            })
    
    # Search in Teacher using trigram similarity
    if 'teacher' in filter_types:
        teachers_qs = Teacher.objects.annotate(
            similarity=Greatest(
                Coalesce(TrigramSimilarity('name', query), Value(0.0)),
                Coalesce(TrigramSimilarity('department', query), Value(0.0)),
                Coalesce(TrigramSimilarity('bio', query), Value(0.0))
            ),
            snippet=Coalesce(NullIf(Trim(Substr('bio', 1, 200)), Value('')), Value('')),
        ).annotate(
            popularity_norm=Least(F('rating_reviews_count') / Value(100.0), Value(1.0)),
            final_score=F('similarity') * Value(0.9) + F('popularity_norm') * Value(0.1)
        )

        if is_short_query:
            prefix_filter = Q(name__istartswith=query) | Q(department__istartswith=query)
            text_fallback = Q(name__icontains=query) | Q(department__icontains=query) | Q(bio__icontains=query)
            teachers_qs = teachers_qs.filter(Q(similarity__gte=SIMILARITY_THRESHOLD) | prefix_filter | text_fallback)
        else:
            teachers_qs = teachers_qs.filter(similarity__gte=SIMILARITY_THRESHOLD)

        teachers = teachers_qs.order_by('-final_score', '-updated_at')[:60]
        
        for teacher in teachers:
            snippet = teacher.snippet or (f"{teacher.title} - {teacher.department}" if teacher.title or teacher.department else '')
            
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
                'score': float(getattr(teacher, 'final_score', getattr(teacher, 'similarity', 0.0)))
            })
    
    # Search in User/Profile using trigram similarity
    if 'user' in filter_types:
        profiles_qs = Profile.objects.annotate(
            similarity=Coalesce(TrigramSimilarity('nickname', query), Value(0.0))
        )

        if is_short_query:
            prefix_filter = Q(nickname__istartswith=query)
            text_fallback = Q(nickname__icontains=query)
            profiles_qs = profiles_qs.filter(Q(similarity__gte=SIMILARITY_THRESHOLD) | prefix_filter | text_fallback)
        else:
            profiles_qs = profiles_qs.filter(similarity__gte=SIMILARITY_THRESHOLD)

        profiles = profiles_qs.select_related('user').annotate(
            posts_count=Count('user__forum_posts', distinct=True),
            reviews_count=Count('user__course_reviews', distinct=True)
        ).annotate(
            popularity_norm=Least((F('posts_count') + F('reviews_count')) / Value(100.0), Value(1.0)),
            final_score=F('similarity') * Value(0.9) + F('popularity_norm') * Value(0.1)
        ).order_by('-final_score')[:60]
        
        for profile in profiles:
            user = profile.user
            
            # Build snippet with pronouns if available
            snippet_parts = []
            if profile.pronouns and profile.pronouns != 'not_specified':
                snippet_parts.append(profile.pronouns)
            
            results.append({
                **_build_search_result(
                    'user', user.id, profile.nickname, ' | '.join(snippet_parts) if snippet_parts else '', f"/user/{user.id}",
                    {
                        'nickname': profile.nickname,
                        'avatar_url': profile.avatar_url,
                        'posts_count': profile.posts_count,
                        'reviews_count': profile.reviews_count,
                        'pronouns': profile.pronouns if profile.pronouns != 'not_specified' else None
                    }
                ),
                'score': float(getattr(profile, 'final_score', getattr(profile, 'similarity', 0.0)))
            })
    
    # Sort all results by final score (fallback to similarity if needed)
    results.sort(key=lambda x: x.get('score', x.get('similarity', 0)), reverse=True)
    
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