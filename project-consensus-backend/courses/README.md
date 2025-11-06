# Courses App

This module strictly aligns with frontend `src/types/course.ts` and `CourseDetailCard` component fields, providing APIs for course information, course reviews, and review replies. The minimal viable loop for "read-only courses, course review/reply creation and updates, permissions, and aggregated statistics" is complete.

## Features Overview

This module provides a complete course evaluation system, including:

- **Course Information Management**: Basic course info, terms, instructors, rating and attribute aggregations
- **Course Review System**: Supports rating reviews (0-10 score + four dimensions) and text-only reviews, with anonymous posting
- **Review Reply System**: Single-level reply structure, supports @mention user replies
- **Like and Vote**: Review/reply likes (idempotent operations), course recommend/not-recommend voting
- **Advanced Filtering and Sorting**: Multi-dimensional filtering (rating range, term, department, course category, level, etc.), multiple sorting options
- **Concurrency Safety**: All aggregate updates use transactions + F() expressions to ensure atomicity
- **Security Protection**: HTML content whitelist sanitization (read + write double protection), permission control, input validation

### Frontend-Backend Integration

- **Frontend Route Mapping**:
  - Course List: `/courses` → `GET /api/courses/`
  - Course Detail: `/courses/[courseId]` → `GET /api/courses/{courseId}/`
  - Write Review: `/courses/[courseId]/review` → `POST /api/courses/{courseId}/reviews/`
- **Data Format Alignment**: All API responses use camelCase naming, strictly consistent with frontend TypeScript types (`src/types/course.ts`)
- **Real-time Aggregation**: Automatically recalculates course rating, review count, reply count and other statistics after review creation/update/deletion
- **User State Injection**: Course detail automatically injects current user's vote state (`userVote`) and whether already reviewed (`userHasReview`)

## Models

- `Course`

  - `course_id` (UUID, primary key) → frontend `courseId`
  - `subject_code` (string) → frontend `subjectCode`
  - `title` (string)
  - `term_year` (integer) + `term_semester` (`spring|summer|fall`) → frontend `term`
  - `terms` (JSON, list of `{year, semester}`) → frontend `terms`
  - `rating_score` (float), `rating_reviews_count` (integer) → frontend `rating.score`, `rating.reviewsCount`
  - `rating_recommend_count`, `rating_not_recommend_count` → frontend `rating.recommendCount`, `rating.notRecommendCount`
  - `attr_difficulty`, `attr_workload`, `attr_grading`, `attr_gain` → frontend `attributes.{...}`
  - `teachers` (many-to-many to `teachers.Teacher`) → frontend `teachers[]` (`id`, `name`, `avatarUrl`)
  - `department` (string)
  - `last_updated` (datetime) → frontend `lastUpdated`
  - Course detail extra metadata:
    - `ai_summary` → frontend `aiSummary`
    - `teaching_type` → frontend `teachingType`
    - `course_category` → frontend `courseCategory`
    - `offering_department` → frontend `offeringDepartment` (displayed as a dedicated first line on the course detail card)
    - `level` (string)
    - `credits` (string, for compatibility with numbers or text)
    - `course_homepage_url` → frontend `courseHomepageUrl`
    - `syllabus_url` → frontend `syllabusUrl`
  - `curriculum` (JSON) → frontend `curriculum`: Course curriculum (college → major → semester)
    - Structure:
      ```json
      [
        {
          "id": "eng",
          "name": "Faculty of Engineering",
          "majors": [
            {
              "id": "cs",
              "name": "Computer Science",
              "semesters": [
                {
                  "id": "cs-2024-fall",
                  "year": 2024,
                  "semester": "fall",
                  "url": "/programs/eng/cs/2024-fall",
                  "yearLevel": "y3"
                }
              ]
            }
          ]
        }
      ]
      ```

- `CourseReview`

  - Aligns with frontend `CourseReview`: overall rating, content, likes count, term (year/semester), replies count, anonymous/text-only flags
  - Text field: `content` is `TextField`, stores HTML string output from frontend editor (Note: current stage doesn't sanitize HTML on server side; frontend display side limits/sanitizes; server-side whitelist sanitization will be added later)

- `CourseReviewReply`

  - Single-level reply: content, `reply_to_user`, likes count, is deleted flag

- `CourseReviewLike` / `CourseReviewReplyLike`
  - Stores user likes, used to calculate `isLiked`

## Serializers (camelCase Output + Write Mapping)

- `CourseSerializer`

  - Outputs nested fields required by frontend: `rating`, `attributes`, `teachers`
  - Outputs `terms` list (falls back to single-element array composed of current `term` when empty)
  - Outputs `otherTeacherCourses`: Other courses with same `subjectCode` but different `courseId`, with teacher, rating, and attribute summary
  - Passes through `curriculum` field (with light structure validation):
    - `college.majors[]` must be array; `major.semesters[]` must be array; `semester.semester ∈ {spring, summer, fall}`; `year` is integer

- `CourseReviewSerializer`

  - Read (output): `author`, `overallRating`, `attributes`, `likesCount`, `createdAt`, `updatedAt`, `term`, `repliesCount`, `isLiked`
  - Write (input mapping):
    - `overallRating` → `overall_rating`
    - `attributes.difficulty|workload|grading|gain` → `attr_difficulty|attr_workload|attr_grading|attr_gain`
    - `term.year|term.semester` → `term_year|term_semester`
    - `isAnonymous` → `is_anonymous`, `onlyText` → `only_text`, `content` → `content`
  - Validation (when onlyText=false):
    - `overallRating` required, range 0–10 (range enforcement by frontend/business logic; serializer checks existence and type)
    - `attributes` four dimensions (difficulty/workload/grading/gain) all required and must be strings
    - `term` optional; if provided, `year` must be integer, `semester ∈ {spring, summer, fall}`
  - Anonymous display: Hides identity except from author (` author.name = Anonymous`)

- `CourseReviewReplySerializer`
  - Read (output): `author`, `replyToUser`, `likes`, `isLiked`, `isDeleted`, `createdAt`
  - Write (input):
    - Must specify parent review (see API conventions); optional `replyToUserId` to specify "reply target"

## ViewSets & Routes

Base path: `/api/` (DRF Router)

- `/api/courses/`

  - `GET /api/courses/` list (supports search: `subject_code`, `title`, `department`; supports filters: `subjectCode`, `department`, `teacherId`)
  - `GET /api/courses/{courseId}/` detail (lookup by `course_id`)
  - `GET|POST /api/courses/{courseId}/reviews/` get/create reviews for this course (nested route: POST doesn't need to pass `courseId` again)
    - GET returns paginated response, supports `page`, `page_size` (default 10, max 50)

- `/api/reviews/`

  - `GET /api/reviews/`: filter by `?course=<pk>` or `?courseId=<uuid>`
  - `POST /api/reviews/`: global creation endpoint, must include `courseId` in body; after successful save, writes back course aggregates (average score, count)
  - `POST /api/reviews/{id}/like`: like this review (idempotent), count increments; `POST /api/reviews/{id}/unlike`: unlike review (idempotent), count decrements (not below 0)
  - GET returns paginated response, supports `page`, `page_size` (default 10, max 50)

- `/api/replies/`
  - `GET /api/replies/`: filter by `?review=<uuid>`
  - `POST /api/replies/`: create review reply, body must include `reviewId` (optional `replyToUserId`); after successful save, updates parent review's `replies_count`
  - `POST /api/replies/{id}/like` / `POST /api/replies/{id}/unlike`: reply like/unlike (idempotent)
  - GET returns paginated response, supports `page`, `page_size` (default 10, max 50)

### Review List Filtering and Sorting

- `GET /api/reviews/` additionally supports parameters:
  - `minRating`, `maxRating`: rating range filter (0..10)
  - `termYear`, `termSemester`: filter by term (`semester ∈ {spring, summer, fall}`); currently only supports single term filter, recommend not passing this parameter when frontend has multiple selections
  - `ordering`: sort field (`created_at`, `updated_at`, `likes_count`, `overall_rating`, prefix `-` for descending)

### Course Recommend/Not Recommend Voting

- `POST /api/courses/{courseId}/vote/`
  - Body: `{ "voteType": "recommend" | "notRecommend" }`
  - Logic:
    - No existing vote → create new vote, count increments
    - Same as existing vote → considered "cancel vote", count decrements
    - Different from existing vote → switch vote, old count decrements, new count increments
  - Concurrency safety:
    - In transaction, locks user-course vote row via `select_for_update()`, paired with `F()` expression for atomic course count update
    - (user, course) unique constraint ensures one vote per person
  - Response:
    ```json
    {
      "courseId": "<uuid>",
      "rating": { "recommendCount": 12, "notRecommendCount": 3 },
      "userVote": "recommend" | "notRecommend" | null
    }
    ```

## Permissions & Ownership

- Read (list/retrieve): allows anonymous access
- Write (create/update/delete): must be logged in
- Modify/delete: only author or admin allowed

## Rating Aggregations

- Auto-update trigger: When course reviews are created, updated, or deleted, recalculates aggregate fields for the course (see `CourseReviewViewSet.perform_create/perform_update/perform_destroy`)
- Recalculation rules:
  - `rating_reviews_count`: only counts reviews with `only_text = false` (text-only reviews not included in rating sample)
  - `rating_score`: only averages `overall_rating` from reviews with `only_text = false`, rounded to 1 decimal place; if no rating reviews, defaults to `0.0`
- Reply count: After creating/deleting replies, updates parent review's `replies_count`

Note: Aggregate updates are wrapped in database transactions to avoid read-write race conditions; rating kept to one decimal place consistent with frontend display.

## Likes and Votes (Concurrency Safe)

- Review and reply likes (like/unlike):
  - Like/unlike both execute in database transactions, using `get_or_create` and `F()` for atomic count updates
  - Unique constraint ensures only one like record per user per object (deduplication), repeated like/unlike is idempotent
  - API returns latest object data (including `likesCount` and `isLiked`)
- Course recommend/not-recommend voting (vote):
  - API: `POST /api/courses/{courseId}/vote/`, request body: `{ "voteType": "recommend" | "notRecommend" }`
  - Logic:
    - First vote: creates `CourseVote` record, atomically increments corresponding course `rating_recommend_count` or `rating_not_recommend_count`
    - Click same option again: considered "cancel", deletes vote record, atomically decrements corresponding count (min 0)
    - Switch to another option: atomically "old option -1 + new option +1", updates vote record `value`
  - Response:
    ```json
    {
      "courseId": "<uuid>",
      "rating": { "recommendCount": 12, "notRecommendCount": 3 },
      "userVote": "recommend" | "notRecommend" | null
    }
    ```
  - Concurrency safety: All count increases/decreases use `F()` expressions in transactions, avoiding race conditions

Note: Vote counts and rating aggregates are independent (votes don't participate in `rating_score` calculation), only used for "recommend/not recommend" visualization.

---

## Course Attributes and Frontend Filter Integration (level/courseCategory, etc.)

Backend `Course` model and serializer output course metadata to support frontend filtering and detail display:

- Detail display fields (all optional strings):
  - `teachingType` (teaching type), `courseCategory` (course category/tags), `offeringDepartment` (offering department, frontend falls back to `department` if empty; rendered as a dedicated first line in the course card), `level` (course level, unified as string `'1'..'6'`), `credits` (credits, string for compatibility with "3.0/TBD", etc.)

### Course List Filter Parameters (GET /api/courses/)

- Basic:
  - `ordering`: `-rating_score` | `-rating_reviews_count` | `-last_updated`
  - `subjectCode`: exact match course code
  - `department`: by department name (case-insensitive, supports multiple values: repeated params or comma-separated, semantic OR)
  - `teacherId`: instructor UUID (optional)
  - `search`: full-text search (`subject_code/title/department`)
- New (linked with frontend filter):
  - `courseCategory` / `categories`: multi-value (repeated params or comma-separated)
  - `teachingType`: multi-value
  - `level` / `levels`: multi-value, unified as `'1'..'6'`; supports repeated params or `levels=1,2,3`

Note: For frontend compatibility, server accepts both repeated keys or comma-separated forms, multi-value conditions are "any match (OR in list)". `department` follows same rule; if department name contains comma, recommend using repeated parameter form.

Integration with frontend `CourseFilterBar` (see `project-consensus-frontend/src/components/CourseFilterBar.tsx` and list page `src/app/courses/page.tsx`):

Example (multi-value filter parameter usage):

- Detailed categories (using alias `categories` repeated params):
  - `/api/courses/?categories=projectHeavy&categories=examHeavy`
  - Or comma-separated: `/api/courses/?categories=projectHeavy,examHeavy`
- Course levels (using `level` repeated params; values must be `'1'..'6'`):

  - `/api/courses/?level=1&level=2&level=3`
  - Or comma-separated (alias `levels`): `/api/courses/?levels=1,2,3`

- Effective parameters: sorting (rating/reviews/composite → `ordering`), course code (`subjectCode`), department (multi-select → `department` multi-value), title and teacher name (merged into `search`), detailed categories (`categories`→`courseCategory` multi-select), level (`level` multi-select).

About `level`:

- Unified as string `'1'..'6'` (database `CharField(max_length=1)`, provides enum choices)
- Local/development seed data already uses `'1'..'6'`, no additional migration script needed
- List filtering supports multi-select: `?level=1&level=2` or `?levels=1,2`

## Notes

- Frontend needs each item in `teachers[]` to include `id` and `name`, `avatarUrl` optional
- `otherTeacherCourses` is computed field; recommend creating separate `Course` records for same `subjectCode` with different instructors
- `credits` stored as string, convenient for compatibility with "3.0" or "TBD" display
- Review content (`content`) currently stored as-is (HTML string), frontend reply rendering does strict whitelist sanitization; server-side sanitization will be introduced later for enhanced security
  - `userVote` (only returned in course "detail" when logged in; not returned in course "list"): current user's vote state for this course (`recommend` | `notRecommend` | `null`)
    - To avoid N+1 queries, only annotated via subquery `_user_vote` in detail retrieval (`CourseViewSet.get_queryset`) for serializer
    - Detail falls back to single record query if not annotated; list doesn't include this field to reduce load

## Auxiliary Metadata (Department List)

- New endpoint: `GET /api/courses/departments/`
  - Purpose: returns list of department names existing in current database, for frontend filter dynamic display, avoiding filter failure due to "department code" and "department name" inconsistency
  - Response example:
    ```json
    { "departments": ["Computer Science", "Mathematics", "Physics"] }
    ```

## Data Seeding

Provides management command for convenient batch generation of courses, reviews, and reply data in local/test environments:

- Management command: `seed_courses`

  - Path: `courses/management/commands/seed_courses.py`
  - Functions:
    - Ensures at least N users, M teachers exist (for attaching authors and instructors)
    - Generates specified number of courses (default 500)
    - Generates course reviews (default 5000) and review replies (default 1000)
    - Auto writes back course rating aggregates (average score, review count) and each review's reply count
  - Usage examples:
    - `python manage.py seed_courses` (defaults 500/5000/1000)
    - `python manage.py seed_courses --courses 200 --reviews 1500 --replies 300 --seed 42`
    - `python manage.py seed_courses --purge` (clears existing courses/reviews/replies before seeding)

- Convenience script: `scripts/seed_courses.sh`
  - Supports environment variables: `COURSES_COUNT`, `REVIEWS_COUNT`, `REPLIES_COUNT`, `SEED`
  - Example: `COURSES_COUNT=300 REVIEWS_COUNT=3000 REPLIES_COUNT=600 ./scripts/seed_courses.sh --purge`

Generation rules summary:

- Courses: randomly generated `subjectCode` by department (20% chance to reuse same course code to simulate different sections with different instructors), with several historical terms, course metadata, and instructors (1-2)
- Reviews: `onlyText` ~12%, `isAnonymous` ~15%; rest have 0-10 overall rating and four dimensions (difficulty, workload, grading, gain), with randomly generated HTML content and term info; like count 0-25 random value
- Replies: randomly picks reviews to generate 1000 single-level replies, with optional `replyToUser`, like count 0-10 random value
- Aggregation: after completion, recalculates course `rating.score` (1 decimal place) and `rating.reviewsCount` based on "non-text-only reviews"; writes back `repliesCount` for each review

---

## Technical Implementation Details

### 1. Concurrency Safety Strategy

All count update operations use database transactions + F() expressions to avoid race conditions:

```python
# Example: Atomic like count update
with transaction.atomic():
    _, created = CourseReviewLike.objects.get_or_create(review=review, user=user)
    if created:
        CourseReview.objects.filter(pk=review.pk).update(
            likes_count=F("likes_count") + 1
        )
```

- **Review aggregation**: Uses `select_for_update()` to lock course row, avoiding count inconsistency from concurrent reviews
- **Vote switching**: In transaction, first `select_for_update()` locks vote record, then atomically updates course counts
- **Unique constraints**: `(user, course)` one vote per person, `(user, review)` one review per person, database-level guarantee

### 2. HTML Content Security (XSS Protection)

Uses **read + write double protection** strategy:

- **Write-time sanitization**: `create()`/`update()` methods call `bleach.clean()` to sanitize HTML
- **Read-time sanitization**: `to_representation()` sanitizes again, defending against unsafe content already in database
- **Whitelist strategy**: Only allows basic formatting tags (p/h1-h3/ul/ol/li/strong/em/code/pre/blockquote/table), forbids dangerous tags like script/iframe/style

```python
ALLOWED_TAGS = [
    'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'br',
    'strong', 'em', 'code', 'pre', 'blockquote',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
]
ALLOWED_ATTRS = {
    'td': ['colspan', 'rowspan', 'align'],
    'th': ['colspan', 'rowspan', 'align'],
    'code': ['class'],  # Support syntax highlighting
    'pre': ['class'],
    'ol': ['start'],
}
```

### 3. Performance Optimization

- **N+1 Query Optimization**:

  - `select_related('author', 'course')` prefetch foreign keys
  - `prefetch_related('teachers', 'author__profile')` prefetch many-to-many and reverse relations
  - Queryset-level annotation of `is_liked`/`user_vote`, avoiding per-serializer queries

- **Pagination Support**: All list endpoints support pagination (default 10 per page, max 50), reducing single data transfer size

- **Conditional Annotation**: Only annotate user state fields when needed (e.g., detail page), skip on list page to improve performance

```python
# Only annotate user vote state on detail page
if self.action == "retrieve":
    vote_sq = CourseVote.objects.filter(user=user, course=OuterRef("pk")).values("value")[:1]
    qs = qs.annotate(_user_vote=Subquery(vote_sq, output_field=CharField()))
```

### 4. Data Validation & Business Rules

- **Rating review vs text-only review**:

  - `onlyText=false`: must provide `overallRating` (0-10) and four dimension attributes (difficulty/workload/grading/gain)
  - `onlyText=true`: skip rating validation, `overall_rating` auto set to 0, doesn't participate in course average calculation

- **Anonymous Protection**:

  - Serializer output detects `is_anonymous` flag
  - Non-authors see `author.id=""`, `author.name="Anonymous"`

- **Uniqueness Constraint**:

  - Each user can only publish one review per course (database constraint: `unique_course_review_per_user`)
  - Frontend decides whether to show "Write Review" or "Edit Review" button via `userHasReview` field

- **Cascade Updates**:
  - Review create/update/delete → recalculate course aggregates (rating, counts) → recalculate instructor aggregates
  - Reply create/delete → update parent review's `replies_count`

---

## Frontend Integration Examples

### Get Course List (with Filters and Sorting)

```typescript
// Frontend code example: src/app/courses/page.tsx
const query = new URLSearchParams({
  page: "1",
  page_size: "20",
  ordering: "-rating_score", // Sort by rating descending
  department: "Computer Science", // Filter by department
  level: "3", // Course level
  search: "algorithm", // Full-text search
});
const response = await apiGet<PaginatedResponse<Course>>(
  `/api/courses/?${query}`
);
```

### Create Course Review

```typescript
// Frontend code example: src/lib/api/course.ts
const payload = {
  onlyText: false,
  overallRating: 8.5,
  attributes: {
    difficulty: "medium",
    workload: "moderate",
    grading: "balanced",
    gain: "high",
  },
  content: "<p>This course is very practical...</p>",
  isAnonymous: false,
  term: { year: 2024, semester: "fall" },
};
const review = await createCourseReview(courseId, payload);
```

### Course Voting (Recommend/Not Recommend)

```typescript
// Frontend code example: User clicks "Recommend" button
const result = await voteCourse(courseId, "recommend");
// result: { courseId, rating: { recommendCount, notRecommendCount }, userVote }
```

### Like Review (Idempotent Operation)

```typescript
// User clicks like button (use toggle mode to auto determine like/unlike)
const updatedReview = await toggleLikeReview(reviewId);
// Update local state
setReviews((prev) => prev.map((r) => (r.id === reviewId ? updatedReview : r)));
```

---

## Development & Testing

### Local Development Environment Setup

1. Install dependencies:

   ```bash
   cd project-consensus-backend
   pip install -r requirements.txt
   ```

2. Run database migrations:

   ```bash
   python manage.py migrate
   ```

3. Generate test data (optional):

   ```bash
   python manage.py seed_courses --courses 100 --reviews 500 --replies 200
   ```

4. Start development server:
   ```bash
   python manage.py runserver
   ```

### API Testing Examples

Test API endpoints using curl or httpie:

```bash
# Get course list
curl http://localhost:8000/api/courses/?page=1&page_size=10

# Get course detail (requires course UUID)
curl http://localhost:8000/api/courses/{courseId}/

# Create review (requires login token)
curl -X POST http://localhost:8000/api/courses/{courseId}/reviews/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "overallRating": 8.5,
    "attributes": {
      "difficulty": "medium",
      "workload": "moderate",
      "grading": "balanced",
      "gain": "high"
    },
    "content": "<p>Test review</p>",
    "onlyText": false
  }'

# Like review
curl -X POST http://localhost:8000/api/reviews/{reviewId}/like/ \
  -H "Authorization: Bearer YOUR_TOKEN"

# Course vote
curl -X POST http://localhost:8000/api/courses/{courseId}/vote/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"voteType": "recommend"}'
```

### Troubleshooting

**Q: Course rating not updated after creating review?**

- A: Check if review's `only_text` field is `false`; text-only reviews don't participate in rating calculation

**Q: IntegrityError when creating concurrent reviews?**

- A: This is expected behavior, database constraint prevents multiple reviews from same user; frontend should catch error code `already_reviewed` and notify user

**Q: Like count occasionally inaccurate?**

- A: Check if updating count outside transaction; all count updates must use `F()` expression wrapped in `transaction.atomic()`

**Q: HTML content over-sanitized, losing formatting?**

- A: Check `ALLOWED_TAGS` and `ALLOWED_ATTRS` configuration; if need to support more tags, modify whitelist in `serializers.py`

---

## Related Files

- **Frontend Type Definitions**: `project-consensus-frontend/src/types/course.ts`
- **Frontend API Wrapper**: `project-consensus-frontend/src/lib/api/course.ts`
- **Course List Page**: `project-consensus-frontend/src/app/courses/page.tsx`
- **Course Detail Page**: `project-consensus-frontend/src/app/courses/[courseId]/page.tsx`
- **Review Write Page**: `project-consensus-frontend/src/app/courses/[courseId]/review/page.tsx`
- **Teacher Module**: `../teachers/README.md` (course-teacher association)
- **Forum Module**: `../forum/README.md` (reference similar comment-reply structure)
- **User Authentication**: `../accounts/README.md` (login state and permission control)

---
