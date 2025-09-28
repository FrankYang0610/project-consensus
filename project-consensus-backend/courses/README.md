# 课程模块（Courses App）

本模块与前端 `src/types/course.ts` 及 `CourseDetailCard` 组件的字段严格对齐，提供课程基础信息、课程评价与评价回复接口。

## 模型（Models）

- `Course`
  - `subject_id`（UUID，主键）→ 前端 `subjectId`
  - `subject_code`（字符串）→ 前端 `subjectCode`
  - `title`（字符串）
  - `term_year`（整型）+ `term_semester`（`spring|summer|fall`）→ 前端 `term`
  - `terms`（JSON，形如 `{year, semester}` 的列表）→ 前端 `terms`
  - `rating_score`（浮点）、`rating_reviews_count`（整型）→ 前端 `rating.score`、`rating.reviewsCount`
  - `rating_recommend_count`、`rating_not_recommend_count` → 前端 `rating.recommendCount`、`rating.notRecommendCount`
  - `attr_difficulty`、`attr_workload`、`attr_grading`、`attr_gain` → 前端 `attributes.{...}`
  - `teachers`（多对多至 `teachers.Teacher`）→ 前端 `teachers[]`（`id`,`name`,`avatarUrl`）
  - `department`（字符串）
  - `last_updated`（时间）→ 前端 `lastUpdated`
  - 课程详情额外元数据：
    - `ai_summary` → 前端 `aiSummary`
    - `selection_category` → 前端 `selectionCategory`
    - `teaching_type` → 前端 `teachingType`
    - `course_category` → 前端 `courseCategory`
    - `offering_department` → 前端 `offeringDepartment`
    - `level`（字符串）
    - `credits`（字符串，便于兼容数字或文本）
    - `course_homepage_url` → 前端 `courseHomepageUrl`
    - `syllabus_url` → 前端 `syllabusUrl`
  - `curriculum`（JSON）→ 前端 `curriculum`：课程所属培养方案（学院 → 专业 → 学期）
    - 结构：
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
                { "id": "cs-2024-fall", "year": 2024, "semester": "fall", "url": "/programs/eng/cs/2024-fall", "yearLevel": "y3" }
              ]
            }
          ]
        }
      ]
      ```

- `CourseReview`
  - 对齐前端 `CourseReview`：总体评分、内容、点赞数、学期（year/semester）、回复数、匿名/仅文本等

- `CourseReviewReply`
  - 单层回复：内容、`reply_to_user`、点赞数、是否删除

- `CourseReviewLike` / `CourseReviewReplyLike`
  - 存储用户点赞，用于计算 `isLiked`

## 序列化（Serializers，camelCase 输出）

- `CourseSerializer`
  - 输出前端所需嵌套字段：`rating`、`attributes`、`teachers`
  - 输出 `terms` 列表（为空时回退为当前 `term` 组成的单元素数组）
  - 输出 `otherTeacherCourses`：同一 `subjectCode` 下的其他课程（不同 `subjectId`），附老师、评分与属性摘要
  - 直通 `curriculum` 字段（并做轻度结构校验）：
    - `college.majors[]` 必为数组；`major.semesters[]` 必为数组；`semester.semester ∈ {spring, summer, fall}`；`year` 为整数

- `CourseReviewSerializer`
  - 输出 `author`、`overallRating`、`attributes`、`likesCount`、`createdAt`、`updatedAt`、`term`、`repliesCount`、`isLiked`
  - 支持匿名显示（除作者本人外隐藏身份）

- `CourseReviewReplySerializer`
  - 输出 `author`、`replyToUser`、`likes`、`isLiked`、`isDeleted`、`createdAt`

## 视图与路由（ViewSets & Routes）

基础路径：`/api/`（DRF Router）

- `/api/courses/`
  - `GET /api/courses/` 列表（支持搜索：`subject_code`、`title`、`department`；支持过滤：`subjectCode`、`department`、`teacherId`）
  - `GET /api/courses/{subjectId}/` 详情（按 `subject_id` 查找）
  - `GET|POST /api/courses/{subjectId}/reviews/` 获取/创建该课程的评价

- `/api/reviews/`
  - 通过 `?course=<pk>` 或 `?subjectId=<uuid>` 过滤

- `/api/replies/`
  - 通过 `?review=<uuid>` 过滤

## 说明

- 前端需要 `teachers[]` 的每项包含 `id` 和 `name`，`avatarUrl` 可选。
- `otherTeacherCourses` 为计算字段；推荐为同一 `subjectCode` 的不同老师创建独立 `Course` 记录。
- `credits` 以字符串存储，方便兼容“3.0”或“待定”等展示。
