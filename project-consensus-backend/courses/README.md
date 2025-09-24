# Courses App

The Courses app provides minimal models and APIs for courses, course reviews, and single-level review replies. It aligns with the frontend type definitions.

## Models

- `Course`
  - Keys: `subject_id` (unique), `subject_code`, `title`
  - `term_year`, `term_semester` (choices: `spring`, `summer`, `fall`)
  - Rating aggregate: `rating_score` (0–10), `rating_reviews_count`
  - Attributes (choices): `attr_difficulty`, `attr_workload`, `attr_grading`, `attr_gain`
  - `teachers` (JSON list of names), `department`, `last_updated`

- `CourseReview`
  - UUID primary key
  - `course` (FK), `author` (FK), `overall_rating`
  - Attribute breakdown: difficulty/workload/grading/gain
  - `content`, `likes_count`, `created_at`, `updated_at`
  - Optional `term_year`, `term_semester`, and `replies_count`

- `CourseReviewReply`
  - UUID primary key
  - `review` (FK), `author` (FK), optional `reply_to_user` (FK)
  - `content`, `created_at`, `likes_count`, `is_deleted`

## Serializers

- `CourseSerializer`
  - Presents nested `term`, `rating`, and `attributes` objects for frontend convenience

- `CourseReviewSerializer`
  - Aligns with frontend `CourseReview` shape and includes author payload

- `CourseReviewReplySerializer`
  - Aligns with frontend `CourseReviewReply`, including `replyToUser`

## ViewSets & Routes

Mounted under `/api/` (via DRF Router):

- `/api/courses/` — Course CRUD
- `/api/reviews/` — Course review CRUD; filter by `?course=<id>`
- `/api/replies/` — Review reply CRUD; filter by `?review=<review_id>`

## Examples

List courses:

```bash
curl 'http://127.0.0.1:8000/api/courses/'
```

List reviews by course:

```bash
curl 'http://127.0.0.1:8000/api/reviews/?course=<course-id>'
```

List replies by review:

```bash
curl 'http://127.0.0.1:8000/api/replies/?review=<review-id>'
```

