"""
Search services for global search functionality.
"""

from django.db.models import Q, F, Value, FloatField, Case, When, Count
from django.contrib.postgres.search import TrigramSimilarity
from django.db.models.functions import Greatest, Coalesce, Substr, Least, Trim, NullIf

from courses.models import Course, CourseReview
from forum.models import ForumPost, ForumPostComment
from wiki.models import WikiPage
from teachers.models import Teacher
from accounts.models import Profile

from .algorithms import (
    get_similarity_threshold,
    create_popularity_norm,
    create_final_score_expr,
    create_snippet_expr,
    apply_short_query_filters,
)
from .utils import (
    get_author_name,
    build_search_result,
    validate_and_sanitize_search_query,
)

# Result limits
MAX_RESULTS_PER_TYPE = 60    # Maximum results per content type


def search_courses(query: str, similarity_threshold: float, is_short_query: bool) -> list:
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
        snippet=create_snippet_expr('ai_summary', 'title'),
        popularity_norm=create_popularity_norm('rating_reviews_count', 'reviews'),
    ).annotate(
        final_score=create_final_score_expr()
    )

    # Apply filters
    if is_short_query:
        courses_qs = apply_short_query_filters(
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
            **build_search_result(
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


def search_forum_posts(query: str, similarity_threshold: float, is_short_query: bool) -> list:
    """
    Search in ForumPost model using trigram similarity.
    
    Searches across: title, content, author nickname
    Weighted: title (60%), content (35%), author (5%)
    Snippet: post content
    Popularity: based on likes count
    """
    from .algorithms import FORUM_POST_WEIGHTS
    
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
        popularity_norm=create_popularity_norm('likes_count', 'likes'),
        final_score=create_final_score_expr()
    )

    if is_short_query:
        posts_qs = apply_short_query_filters(
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
            'author': get_author_name(post.author) if not post.is_anonymous else 'Anonymous',
            'created_at': post.created_at.isoformat(),
            'likes_count': post.likes_count
        }
        results.append({
            **build_search_result(
                'forum_post', post.id, post.title, snippet, f"/post/{post.id}", metadata
            ),
            'score': float(post.final_score)
        })
    return results


def search_forum_comments(query: str, similarity_threshold: float, is_short_query: bool) -> list:
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
        snippet=create_snippet_expr('content'),
    ).annotate(
        similarity=Greatest(F('content_sim'), F('author_sim')),
        popularity_norm=create_popularity_norm('likes_count', 'likes'),
        final_score=create_final_score_expr()
    ).filter(is_deleted=False)

    if is_short_query:
        comments_qs = apply_short_query_filters(
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
            'author': get_author_name(comment.author) if not comment.is_anonymous else 'Anonymous',
            'created_at': comment.created_at.isoformat(),
            'title_template': 'commentOn',
        }
        results.append({
            **build_search_result(
                'forum_comment', comment.id, comment.post.title, snippet, 
                f"/post/{comment.post.id}#comment-{comment.id}", metadata
            ),
            'score': float(comment.final_score)
        })
    return results


def search_course_reviews(query: str, similarity_threshold: float, is_short_query: bool) -> list:
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
        snippet=create_snippet_expr('content'),
    ).annotate(
        similarity=Greatest(F('content_sim'), F('author_sim')),
        popularity_norm=create_popularity_norm('likes_count', 'likes'),
        final_score=create_final_score_expr()
    )

    if is_short_query:
        reviews_qs = apply_short_query_filters(
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
            **build_search_result(
                'course_review', review.id, course_title, content_snippet,
                f"/courses/{review.course.course_id}#review-{review.id}",
                {
                    'parent_id': str(review.course.course_id),
                    'parent_title': course_title,
                    'author': get_author_name(review.author) if not review.is_anonymous else 'Anonymous',
                    'created_at': review.created_at.isoformat(),
                    'rating': review.overall_rating,
                    'title_template': 'reviewOn',
                }
            ),
            'score': float(review.final_score)
        })
    return results


def search_wiki_pages(query: str, similarity_threshold: float, is_short_query: bool) -> list:
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
        snippet=create_snippet_expr('summary', 'content'),
    ).annotate(
        popularity_norm=create_popularity_norm('view_count', 'views'),
        final_score=create_final_score_expr()
    ).filter(status='published')

    if is_short_query:
        wiki_qs = apply_short_query_filters(
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
            **build_search_result(
                'wiki', wiki_page.id, wiki_page.title, snippet, f"/wiki/{wiki_page.slug}",
                {
                    'author': get_author_name(wiki_page.author),
                    'created_at': wiki_page.created_at.isoformat(),
                    'updated_at': wiki_page.updated_at.isoformat(),
                    'view_count': wiki_page.view_count
                }
            ),
            'score': float(wiki_page.final_score)
        })
    return results


def search_teachers(query: str, similarity_threshold: float, is_short_query: bool) -> list:
    """
    Search in Teacher model using trigram similarity.
    
    Searches across: name, department, biography, research_interests,
    academic_and_professional_experience, professional_qualifications
    Snippet: biography (fallback to research_interests) or title-department combination
    Popularity: based on review count
    """
    teachers_qs = Teacher.objects.annotate(
        similarity=Greatest(
            Coalesce(TrigramSimilarity('name', query), Value(0.0)),
            Coalesce(TrigramSimilarity('department', query), Value(0.0)),
            Coalesce(TrigramSimilarity('biography', query), Value(0.0)),
            Coalesce(TrigramSimilarity('research_interests', query), Value(0.0)),
            Coalesce(TrigramSimilarity('academic_and_professional_experience', query), Value(0.0)),
            Coalesce(TrigramSimilarity('professional_qualifications', query), Value(0.0)),
        ),
        snippet=create_snippet_expr('biography', 'research_interests'),
    ).annotate(
        popularity_norm=create_popularity_norm('rating_reviews_count', 'reviews'),
        final_score=create_final_score_expr()
    )

    if is_short_query:
        teachers_qs = apply_short_query_filters(
            teachers_qs, query, similarity_threshold,
            prefix_fields=['name', 'department'],
            text_fields=['name', 'department', 'biography', 'research_interests', 'academic_and_professional_experience', 'professional_qualifications']
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
            **build_search_result(
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


def search_users(query: str, similarity_threshold: float, is_short_query: bool) -> list:
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
        profiles_qs = apply_short_query_filters(
            profiles_qs, query, similarity_threshold,
            prefix_fields=['nickname'],
            text_fields=['nickname']
        )
    else:
        profiles_qs = profiles_qs.filter(similarity__gte=similarity_threshold)

    # Calculate user activity and final score using stored counters on Profile
    profiles = profiles_qs.select_related('user').annotate(
        activity_score=F('forum_posts_count') + F('course_reviews_count'),
        popularity_norm=Least(F('activity_score') / Value(100.0), Value(1.0)),
        final_score=create_final_score_expr()
    ).order_by('-final_score')[:MAX_RESULTS_PER_TYPE]
    
    results = []
    for profile in profiles:
        user = profile.user
        
        # Build snippet with pronouns if available
        snippet_parts = []
        if profile.pronouns and profile.pronouns != 'not_specified':
            snippet_parts.append(profile.pronouns)
        
        results.append({
            **build_search_result(
                'user', user.id, profile.nickname, 
                ' | '.join(snippet_parts) if snippet_parts else '', 
                f"/user/{user.id}",
                {
                    'nickname': profile.nickname,
                    'avatar_url': profile.avatar_url,
                    'forum_posts_count': profile.forum_posts_count,
                    'course_reviews_count': profile.course_reviews_count,
                    'pronouns': profile.pronouns if profile.pronouns != 'not_specified' else None
                }
            ),
            'score': float(profile.final_score)
        })
    return results


def perform_global_search(query: str, filter_types: set, page: int = 1, page_size: int = 20) -> dict:
    """
    Perform global search across multiple content types.
    
    Args:
        query: Search query string
        filter_types: Set of content types to search (e.g., {'course', 'forum_post'})
        page: Page number (1-based)
        page_size: Results per page
        
    Returns:
        Dictionary with search results and pagination info
    """
    # Validate and sanitize search query
    sanitized_query = validate_and_sanitize_search_query(query)
    
    # Get similarity threshold based on query length
    similarity_threshold, is_short_query = get_similarity_threshold(len(sanitized_query))
    
    results = []
    
    # Search in each enabled content type using dedicated functions
    if 'course' in filter_types:
        results.extend(search_courses(sanitized_query, similarity_threshold, is_short_query))
    
    if 'forum_post' in filter_types:
        results.extend(search_forum_posts(sanitized_query, similarity_threshold, is_short_query))
    
    if 'forum_comment' in filter_types:
        results.extend(search_forum_comments(sanitized_query, similarity_threshold, is_short_query))
    
    if 'course_review' in filter_types:
        results.extend(search_course_reviews(sanitized_query, similarity_threshold, is_short_query))
    
    if 'wiki' in filter_types:
        results.extend(search_wiki_pages(sanitized_query, similarity_threshold, is_short_query))
    
    if 'teacher' in filter_types:
        results.extend(search_teachers(sanitized_query, similarity_threshold, is_short_query))
    
    if 'user' in filter_types:
        results.extend(search_users(sanitized_query, similarity_threshold, is_short_query))
    
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
    
    return {
        "results": paginated_results,
        "total": total,
        "page": page,
        "page_size": page_size
    }

