# 课程模块（Courses App）

本模块与前端 `src/types/course.ts` 及 `CourseDetailCard` 组件字段严格对齐，提供课程基础信息、课程评价与评价回复接口。当前已完成"只读课程、课程评价/回复的创建与更新、权限与聚合统计"的最小闭环。

## 功能概览（Features Overview）

本模块提供完整的课程评价系统，包括：

- **课程信息管理**：课程基本信息、开课学期、授课教师、评分与属性聚合
- **课程评价系统**：支持评分评价（1-10 分+四维度）和纯文本评价，支持匿名发布
- **评价回复系统**：单层回复结构，支持@用户回复
- **点赞与投票**：评价/回复点赞（幂等操作）、课程推荐/不推荐投票
- **高级筛选与排序**：多维度筛选（评分区间、学期、院系、课程类别、层级等）、多种排序方式
- **并发安全**：所有聚合统计更新均使用事务+F()表达式保证原子性
- **安全防护**：HTML 内容白名单清洗（读写双重防护）、权限控制、输入验证

### 前后端集成说明

- **前端路由对接**：
  - 课程列表：`/courses` → `GET /api/courses/`
  - 课程详情：`/courses/[subjectId]` → `GET /api/courses/{subjectId}/`
  - 编写评价：`/courses/[subjectId]/review` → `POST /api/courses/{subjectId}/reviews/`
- **数据格式对齐**：所有 API 响应采用 camelCase 命名，与前端 TypeScript 类型（`src/types/course.ts`）严格一致
- **实时聚合**：评价创建/更新/删除后自动重算课程评分、评价数、回复数等统计字段
- **用户状态注入**：课程详情自动注入当前用户的投票状态（`userVote`）和是否已评价（`userHasReview`）

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

  - 对齐前端 `CourseReview`：总体评分、内容、点赞数、学期（year/semester）、回复数、匿名/仅文本等
  - 文本字段：`content` 为 `TextField`，存储前端编辑器输出的 HTML 字符串（注意：当前阶段服务器端未做 HTML 清洗，前端显示侧会限制/清洗；后续会在服务器端增加白名单清洗）

- `CourseReviewReply`

  - 单层回复：内容、`reply_to_user`、点赞数、是否删除

- `CourseReviewLike` / `CourseReviewReplyLike`
  - 存储用户点赞，用于计算 `isLiked`

## 序列化（Serializers，camelCase 输出 + 写入映射）

- `CourseSerializer`

  - 输出前端所需嵌套字段：`rating`、`attributes`、`teachers`
  - 输出 `terms` 列表（为空时回退为当前 `term` 组成的单元素数组）
  - 输出 `otherTeacherCourses`：同一 `subjectCode` 下的其他课程（不同 `subjectId`），附老师、评分与属性摘要
  - 直通 `curriculum` 字段（并做轻度结构校验）：
    - `college.majors[]` 必为数组；`major.semesters[]` 必为数组；`semester.semester ∈ {spring, summer, fall}`；`year` 为整数

- `CourseReviewSerializer`

  - 读（输出）：`author`、`overallRating`、`attributes`、`likesCount`、`createdAt`、`updatedAt`、`term`、`repliesCount`、`isLiked`
  - 写（输入映射）：
    - `overallRating` → `overall_rating`
    - `attributes.difficulty|workload|grading|gain` → `attr_difficulty|attr_workload|attr_grading|attr_gain`
    - `term.year|term.semester` → `term_year|term_semester`
    - `isAnonymous` → `is_anonymous`，`onlyText` → `only_text`，`content` → `content`
  - 校验（onlyText=false 时）：
    - `overallRating` 必填，范围 0–10（范围限制由前端/业务把控；序列化层检查存在性与类型）
    - `attributes` 四维度（difficulty/workload/grading/gain）均为必填且为字符串
    - `term` 可选；若提供，则 `year` 必须为整数，`semester ∈ {spring, summer, fall}`
  - 匿名显示：除作者本人外隐藏身份（`author.name = Anonymous`）

- `CourseReviewReplySerializer`
  - 读（输出）：`author`、`replyToUser`、`likes`、`isLiked`、`isDeleted`、`createdAt`
  - 写（输入）：
    - 必须指定父评价（见接口约定）；可选 `replyToUserId` 指定“回复对象”

## 视图与路由（ViewSets & Routes）

基础路径：`/api/`（DRF Router）

- `/api/courses/`

  - `GET /api/courses/` 列表（支持搜索：`subject_code`、`title`、`department`；支持过滤：`subjectCode`、`department`、`teacherId`）
  - `GET /api/courses/{subjectId}/` 详情（按 `subject_id` 查找）
  - `GET|POST /api/courses/{subjectId}/reviews/` 获取/创建该课程的评价（嵌套路由：POST 时无需再传 `subjectId`）
    - GET 为分页返回，支持 `page`、`page_size`（默认 10，上限 50）

- `/api/reviews/`

  - `GET /api/reviews/`：通过 `?course=<pk>` 或 `?subjectId=<uuid>` 过滤
  - `POST /api/reviews/`：全局创建入口，必须在 body 携带 `subjectId`；保存成功后会回写课程聚合（平均分、计数）
  - `POST /api/reviews/{id}/like`：点赞该评价（幂等），计数自增；`POST /api/reviews/{id}/unlike`：取消点赞（幂等），计数自减（不低于 0）
  - GET 为分页返回，支持 `page`、`page_size`（默认 10，上限 50）

- `/api/replies/`
  - `GET /api/replies/`：通过 `?review=<uuid>` 过滤
  - `POST /api/replies/`：创建评价回复，body 必须携带 `reviewId`（可选 `replyToUserId`）；保存成功后会更新父评价 `replies_count`
  - `POST /api/replies/{id}/like` / `POST /api/replies/{id}/unlike`：回复点赞/取消点赞（幂等）
  - GET 为分页返回，支持 `page`、`page_size`（默认 10，上限 50）

### 评价列表筛选与排序

- `GET /api/reviews/` 额外支持参数：
  - `minRating`、`maxRating`：评分区间过滤（0..10）
  - `termYear`、`termSemester`：按学期过滤（`semester ∈ {spring, summer, fall}`）；当前仅支持单一学期过滤，前端多选时建议不下发该参数
  - `ordering`：排序字段（`created_at`、`updated_at`、`likes_count`、`overall_rating`，前缀 `-` 表示降序）

### 课程推荐/不推荐投票

- `POST /api/courses/{subjectId}/vote/`
  - Body: `{ "voteType": "recommend" | "notRecommend" }`
  - 逻辑：
    - 未投票 → 产生新投票，计数自增；
    - 与现有投票相同 → 视为“取消投票”，计数自减；
    - 与现有投票不同 → 切换投票，旧计数自减、新计数自增；
  - 并发安全：
    - 在事务中通过 `select_for_update()` 锁定用户-课程投票行，配合 `F()` 表达式原子更新课程计数；
    - (user, course) 唯一约束保证一人一票；
  - 响应：
    ```json
    {
      "subjectId": "<uuid>",
      "rating": { "recommendCount": 12, "notRecommendCount": 3 },
      "userVote": "recommend" | "notRecommend" | null
    }
    ```

## 权限与所有权（Permissions & Ownership）

- 读（list/retrieve）：允许匿名访问
- 写（create/update/delete）：必须登录
- 修改/删除：仅作者本人或管理员允许

## 评分聚合与计数（Aggregations）

- 自动更新触发时机：在课程评价的创建、更新、删除时，均会重算所属课程的聚合字段（见 `CourseReviewViewSet.perform_create/perform_update/perform_destroy`）。
- 重算规则：
  - `rating_reviews_count`：仅统计 `only_text = false` 的评价数量（纯文本评价不计入评分样本）。
  - `rating_score`：仅基于 `only_text = false` 的评价的 `overall_rating` 取平均，保留 1 位小数；若无评分型评价则为 `0.0`。
- 回复计数：创建/删除回复后，会更新父评价的 `replies_count`。

说明：聚合更新均包裹于数据库事务中，避免并发下的读写竞争；评分保留一位小数与前端展示保持一致。

## 点赞与投票（并发安全）

- 评价与回复的点赞（like/unlike）：
  - 点赞/取消点赞均在数据库事务中执行，使用 `get_or_create` 与 `F()` 原子更新计数；
  - 唯一约束保证同一用户对同一对象仅有一条点赞记录（去重），多次重复点赞/取消为幂等；
  - 接口返回最新对象数据（包含 `likesCount` 与 `isLiked`）。
- 课程推荐/不推荐投票（vote）：
  - 接口：`POST /api/courses/{subjectId}/vote/`，请求体：`{ "voteType": "recommend" | "notRecommend" }`；
  - 逻辑：
    - 首次投票：创建 `CourseVote` 记录，并将对应课程 `rating_recommend_count` 或 `rating_not_recommend_count` 原子加一；
    - 再次点击同一选项：视为“取消”，删掉投票记录，并将对应计数原子减一（下限为 0）；
    - 切换到另一选项：原子地“旧选项减一 + 新选项加一”，同时更新投票记录的 `value`；
  - 响应：
    ```json
    {
      "subjectId": "<uuid>",
      "rating": { "recommendCount": 12, "notRecommendCount": 3 },
      "userVote": "recommend" | "notRecommend" | null
    }
    ```
  - 并发安全：所有计数增减均在事务中使用 `F()` 表达式完成，避免竞态。

注：投票计数与评分聚合互不影响（投票不参与 `rating_score` 计算），仅用于“推荐/不推荐”可视化。

---

## 课程属性与前端筛选配合（level/category/selectionCategory 等）

后端 `Course` 模型与序列化器已输出课程元信息以支撑前端筛选与详情展示：

- 详情展示字段（均为可选字符串）：
  - `selectionCategory`（选课类别）、`teachingType`（授课方式）、`courseCategory`（课程类别/标签）、`offeringDepartment`（开课单位，若为空前端回退使用 `department`）、`level`（课程层级，统一为字符串 `'1'..'6'`）、`credits`（学分，字符串以兼容“3.0/待定”等）。

### 课程列表筛选参数（GET /api/courses/）

- 基本：
  - `ordering`：`-rating_score` | `-rating_reviews_count` | `-last_updated`
  - `subjectCode`：精确匹配课程号
  - `department`：按院系名称（不区分大小写，支持多值：重复参数或逗号分隔，语义为 OR）
  - `teacherId`：授课教师 UUID（可选）
  - `search`：全文检索（`subject_code/title/department`）
- 新增（与前端筛选器联动）：
  - `category`：主类目（映射到 `selection_category`），忽略 `all`
  - `selectionCategory`：可多值（重复参数或逗号分隔）
  - `courseCategory` / `categories`：可多值（重复参数或逗号分隔）
  - `teachingType`：可多值
  - `level` / `levels`：可多值，统一为 `'1'..'6'`；支持重复参数或 `levels=1,2,3`

注：为了兼容前端传参，服务端接受重复 key 或逗号分隔两种形式，多值条件为“任一匹配（OR in 列表）”。`department` 同样遵循该规则；若院系名称包含逗号，建议使用重复参数形式。

与前端 `CourseFilterBar` 的对接（见 `project-consensus-frontend/src/components/CourseFilterBar.tsx` 与列表页 `src/app/courses/page.tsx`）：

示例（多值筛选传参用法）：

- 详细类别（使用别名 `categories` 重复参数）：
  - `/api/courses/?categories=projectHeavy&categories=examHeavy`
  - 或逗号分隔：`/api/courses/?categories=projectHeavy,examHeavy`
- 课程等级（使用 `level` 重复参数；值需为 `'1'..'6'`）：

  - `/api/courses/?level=1&level=2&level=3`
  - 或逗号分隔（别名 `levels`）：`/api/courses/?levels=1,2,3`

- 已生效参数：排序（rating/reviews/composite → `ordering`）、课程号（`subjectCode`）、院系（多选 → `department` 多值）、标题与教师名（合并为 `search`）、主类目（`category`→`selection_category`）、详细类目（`categories`→`courseCategory` 多选）、层级（`level` 多选）。

关于 `level` 的说明：

- 已统一为字符串 `'1'..'6'`（数据库层 `CharField(max_length=1)`，提供枚举 choices）。
- 本地/开发环境的种子数据已直接使用 `'1'..'6'`，无需额外迁移脚本。
- 列表筛选支持多选：`?level=1&level=2` 或 `?levels=1,2`。

## 说明

- 前端需要 `teachers[]` 的每项包含 `id` 和 `name`，`avatarUrl` 可选。
- `otherTeacherCourses` 为计算字段；推荐为同一 `subjectCode` 的不同老师创建独立 `Course` 记录。
- `credits` 以字符串存储，方便兼容“3.0”或“待定”等展示。
- 评价内容（`content`）当前为原样存储（HTML 字符串），前端回复渲染已做严格白名单清洗；后续将于服务器端引入清洗以加强安全。
  - `userVote`（仅课程“详情”在登录态下返回；课程“列表”不返回）：当前用户对该课程的投票状态（`recommend` | `notRecommend` | `null`）。
    - 为避免 N+1 查询，仅在详情检索时通过子查询注解 `_user_vote`（`CourseViewSet.get_queryset`）提供给序列化器；
    - 详情若未注解则回退单记录查询；列表不会包含该字段以减少负载。

## 辅助元数据（院系列表）

- 新增接口：`GET /api/courses/departments/`
  - 用途：返回当前数据库中存在的院系名称列表，供前端筛选器动态展示，避免“院系代码”和“院系名称”不一致导致的筛选失效。
  - 响应示例：
    ```json
    { "departments": ["Computer Science", "Mathematics", "Physics"] }
    ```

## 数据造数（Seeding）

提供管理命令便于本地/测试环境批量生成课程、评价与回复数据：

- 管理命令：`seed_courses`

  - 路径：`courses/management/commands/seed_courses.py`
  - 作用：
    - 确保至少 N 名用户、M 名老师存在（便于挂载作者与授课教师）；
    - 生成指定数量的课程（默认 500）；
    - 生成课程评价（默认 5000）与评价回复（默认 1000）；
    - 自动回写课程评分聚合（平均分、评价数）与每条评价的回复数；
  - 使用示例：
    - `python manage.py seed_courses`（默认 500/5000/1000）
    - `python manage.py seed_courses --courses 200 --reviews 1500 --replies 300 --seed 42`
    - `python manage.py seed_courses --purge`（先清空现有课程/评价/回复后再造数）

- 便捷脚本：`scripts/seed_courses.sh`
  - 支持环境变量：`COURSES_COUNT`、`REVIEWS_COUNT`、`REPLIES_COUNT`、`SEED`
  - 示例：`COURSES_COUNT=300 REVIEWS_COUNT=3000 REPLIES_COUNT=600 ./scripts/seed_courses.sh --purge`

生成规则简述：

- 课程：按院系随机生成 `subjectCode`（20% 概率复用同一课程号以模拟不同老师的不同班级），带若干历史学期、课程元数据与授课教师（1–2 名）。
- 评价：`onlyText` 约 12%，`isAnonymous` 约 15%；其余带 0–10 分的总体评分与四个维度（难度、作业量、给分、收获），并随机生成 HTML 内容与学期信息；点赞数为 0–25 随机值。
- 回复：随机挑选评价生成 1000 条单层回复，带可选 `replyToUser`，点赞数为 0–10 随机值。
- 聚合：完成后按"非仅文本评价"重算课程 `rating.score`（保留 1 位小数）与 `rating.reviewsCount`；每条评价回写 `repliesCount`。

---

## 技术实现细节（Technical Implementation）

### 1. 并发安全策略（Concurrency Safety）

所有涉及计数更新的操作均采用数据库事务+F()表达式，避免竞态条件：

```python
# 示例：点赞计数原子更新
with transaction.atomic():
    _, created = CourseReviewLike.objects.get_or_create(review=review, user=user)
    if created:
        CourseReview.objects.filter(pk=review.pk).update(
            likes_count=F("likes_count") + 1
        )
```

- **评价聚合**：使用 `select_for_update()` 锁定课程行，避免并发评价导致计数不一致
- **投票切换**：在事务中先 `select_for_update()` 锁定投票记录，再原子更新课程计数
- **唯一约束**：`(user, course)` 一人一票、`(user, review)` 一人一评价，数据库层面保证

### 2. HTML 内容安全（XSS Protection）

采用**读写双重防护**策略：

- **写入时清洗**：`create()`/`update()` 方法调用 `bleach.clean()` 清洗 HTML
- **读取时清洗**：`to_representation()` 再次清洗，防御数据库中已存在的不安全内容
- **白名单策略**：仅允许基本格式标签（p/h1-h3/ul/ol/li/strong/em/code/pre/blockquote/table），禁止 script/iframe/style 等危险标签

```python
ALLOWED_TAGS = [
    'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'br',
    'strong', 'em', 'code', 'pre', 'blockquote',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
]
ALLOWED_ATTRS = {
    'td': ['colspan', 'rowspan', 'align'],
    'th': ['colspan', 'rowspan', 'align'],
    'code': ['class'],  # 支持代码高亮
    'pre': ['class'],
    'ol': ['start'],
}
```

### 3. 性能优化（Performance Optimization）

- **N+1 查询优化**：

  - `select_related('author', 'course')` 预加载外键
  - `prefetch_related('teachers', 'author__profile')` 预加载多对多和反向关系
  - 查询集级别注解 `is_liked`/`user_vote`，避免序列化器中逐条查询

- **分页支持**：所有列表接口均支持分页（默认 10 条/页，上限 50），减少单次数据传输量

- **条件注解**：仅在需要时（如详情页）注解用户状态字段，列表页跳过以提升性能

```python
# 仅详情页注解用户投票状态
if self.action == "retrieve":
    vote_sq = CourseVote.objects.filter(user=user, course=OuterRef("pk")).values("value")[:1]
    qs = qs.annotate(_user_vote=Subquery(vote_sq, output_field=CharField()))
```

### 4. 数据验证与业务规则（Validation & Business Rules）

- **评分评价 vs 纯文本评价**：

  - `onlyText=false`：必须提供 `overallRating`（0-10）和四维度属性（difficulty/workload/grading/gain）
  - `onlyText=true`：跳过评分验证，`overall_rating` 自动设为 0，不参与课程平均分计算

- **匿名保护**：

  - 序列化器输出时检测 `is_anonymous` 标志
  - 除作者本人外，其他用户看到的 `author.id=""`, `author.name="Anonymous"`

- **唯一性约束**：

  - 每个用户只能对同一课程发布一条评价（数据库约束：`unique_course_review_per_user`）
  - 前端通过 `userHasReview` 字段决定显示"撰写评价"或"编辑评价"按钮

- **级联更新**：
  - 评价创建/更新/删除 → 重算课程聚合（评分、计数）→ 重算授课教师聚合
  - 回复创建/删除 → 更新父评价的 `replies_count`

---

## 前端集成示例（Frontend Integration Examples）

### 获取课程列表（带筛选和排序）

```typescript
// 前端代码示例：src/app/courses/page.tsx
const query = new URLSearchParams({
  page: "1",
  page_size: "20",
  ordering: "-rating_score", // 按评分降序
  department: "Computer Science", // 筛选院系
  level: "3", // 课程层级
  search: "algorithm", // 全文搜索
});
const response = await apiGet<PaginatedResponse<Course>>(
  `/api/courses/?${query}`
);
```

### 创建课程评价

```typescript
// 前端代码示例：src/lib/api/course.ts
const payload = {
  onlyText: false,
  overallRating: 8.5,
  attributes: {
    difficulty: "medium",
    workload: "moderate",
    grading: "balanced",
    gain: "high",
  },
  content: "<p>这门课非常实用...</p>",
  isAnonymous: false,
  term: { year: 2024, semester: "fall" },
};
const review = await createCourseReview(subjectId, payload);
```

### 课程投票（推荐/不推荐）

```typescript
// 前端代码示例：用户点击"推荐"按钮
const result = await voteCourse(subjectId, "recommend");
// result: { subjectId, rating: { recommendCount, notRecommendCount }, userVote }
```

### 点赞评价（幂等操作）

```typescript
// 用户点击点赞按钮（使用toggle模式自动判断like/unlike）
const updatedReview = await toggleLikeReview(reviewId);
// 更新本地状态
setReviews((prev) => prev.map((r) => (r.id === reviewId ? updatedReview : r)));
```

---

## 开发与测试（Development & Testing）

### 本地开发环境设置

1. 安装依赖：

   ```bash
   cd project-consensus-backend
   pip install -r requirements.txt
   ```

2. 运行数据库迁移：

   ```bash
   python manage.py migrate
   ```

3. 生成测试数据（可选）：

   ```bash
   python manage.py seed_courses --courses 100 --reviews 500 --replies 200
   ```

4. 启动开发服务器：
   ```bash
   python manage.py runserver
   ```

### API 测试示例

使用 curl 或 httpie 测试 API 端点：

```bash
# 获取课程列表
curl http://localhost:8000/api/courses/?page=1&page_size=10

# 获取课程详情（需要课程UUID）
curl http://localhost:8000/api/courses/{subjectId}/

# 创建评价（需要登录token）
curl -X POST http://localhost:8000/api/courses/{subjectId}/reviews/ \
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

# 点赞评价
curl -X POST http://localhost:8000/api/reviews/{reviewId}/like/ \
  -H "Authorization: Bearer YOUR_TOKEN"

# 课程投票
curl -X POST http://localhost:8000/api/courses/{subjectId}/vote/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"voteType": "recommend"}'
```

### 常见问题排查（Troubleshooting）

**Q: 评价创建后课程评分没有更新？**

- A: 检查评价的 `only_text` 字段是否为 `false`；纯文本评价不参与评分计算

**Q: 并发创建评价时出现 IntegrityError？**

- A: 这是预期行为，数据库约束防止同一用户多次评价；前端应捕获错误码 `already_reviewed` 并提示用户

**Q: 点赞计数偶尔不准确？**

- A: 检查是否在事务外更新计数；所有计数更新必须使用 `F()` 表达式并包裹在 `transaction.atomic()` 中

**Q: HTML 内容被过度清洗，丢失格式？**

- A: 检查 `ALLOWED_TAGS` 和 `ALLOWED_ATTRS` 配置；如需支持更多标签，需修改 `serializers.py` 中的白名单

---

## 相关参考链接（Related Files）

- **前端类型定义**：`project-consensus-frontend/src/types/course.ts`
- **前端 API 封装**：`project-consensus-frontend/src/lib/api/course.ts`
- **课程列表页**：`project-consensus-frontend/src/app/courses/page.tsx`
- **课程详情页**：`project-consensus-frontend/src/app/courses/[subjectId]/page.tsx`
- **评价编写页**：`project-consensus-frontend/src/app/courses/[subjectId]/review/page.tsx`
- **教师模块**：`../teachers/README.md`（课程与教师关联）
- **论坛模块**：`../forum/README.md`（参考类似的评论回复结构）
- **用户认证**：`../accounts/README.md`（登录态与权限控制）

---
