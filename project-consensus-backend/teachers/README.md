# Teachers Module (教师模块)

教师模块提供教师信息的管理与展示功能，与前端 `src/types/teacher.ts` 类型定义严格对齐。

## Models (模型)

### Teacher

教师实体模型，包含以下字段：

#### Basic Info (基本信息)

- `id` (UUID, 主键) → 前端 `id`
- `name` (字符串, 必需) → 前端 `name`
- `title` (字符串, 可选) → 前端 `title` (例如: Professor, Dr., Lecturer)
- `department` (字符串, 可选) → 前端 `department`

#### Contact Info (联系信息)

- `avatar_url` (URL, 可选) → 前端 `avatarUrl`
- `email` (Email, 可选) → 前端 `email`
- `office` (字符串, 可选) → 前端 `office`
- `office_hours` (字符串, 可选) → 前端 `officeHours`
- `homepage_url` (URL, 可选) → 前端 `homepageUrl`

#### Profile (简介)

- `bio` (文本, 可选) → 前端 `bio`
- `tags` (JSON 数组, 可选) → 前端 `tags` (专业领域标签)
- `languages` (JSON 数组, 可选) → 前端 `languages` (授课语言)
- `years_experience` (整数, 可选) → 前端 `yearsExperience`

#### Rating Metrics (评价指标)

- `rating_overall` (浮点数, null 或 0.0-10.0) → 前端 `rating.overall`
  - **自动计算**：基于该教师所教授的所有课程收到的评价（CourseReview）的平均分
  - 仅统计 `only_text=False` 的评价（带评分的评价）
  - 保留 1 位小数（例如：8.7）
  - 无评价时为 `null`
- `rating_difficulty` (浮点数, 可选) → 前端 `rating.difficulty` (暂未使用)
- `rating_friendliness` (浮点数, 可选) → 前端 `rating.friendliness` (暂未使用)
- `rating_clarity` (浮点数, 可选) → 前端 `rating.clarity` (暂未使用)
- `rating_grading` (选项, 可选) → 前端 `rating.grading` (lenient/balanced/strict) (暂未使用)
- `rating_reviews_count` (整数, 默认 0) → 前端 `rating.reviewsCount`
  - **自动计算**：该教师所教授的所有课程收到的评价总数

#### Timestamps (时间戳)

- `created_at` (时间, 自动) → 前端 `createdAt`
- `updated_at` (时间, 自动) → 前端 `updatedAt`

#### Database Indexes (数据库索引)

- `name` (单字段索引)
- `department` (单字段索引)

## API Endpoints (API 端点)

### 1. List Teachers (获取教师列表)

```
GET /api/teachers/
```

**Query Parameters:**

- `q` (可选): 搜索关键词 (搜索姓名和院系)
- `page` (可选): 页码 (默认: 1)
- `page_size` (可选): 每页数量 (默认: 20, 最大: 100)
- `ordering` (可选): 排序字段
  - `name`: 按姓名升序 (默认)
  - `-name`: 按姓名降序
  - `department`: 按院系升序
  - `-rating_overall`: 按总评分降序
  - `-rating_reviews_count`: 按评价数降序
  - `-updated_at`: 按更新时间降序

**Response:** 分页结果

```json
{
  "count": 100,
  "next": "http://api.example.com/api/teachers/?page=2",
  "previous": null,
  "results": [
    {
      "id": "uuid-string",
      "name": "Prof. Wang Yao Wu",
      "title": "Professor",
      "department": "APSS",
      "avatarUrl": "https://...",
      "email": "wang@polyu.edu.hk",
      "office": "AG702",
      "officeHours": "Tue 14:00-16:00",
      "homepageUrl": "https://...",
      "bio": "Focus on social sciences...",
      "tags": ["Social Sciences", "Research Methods"],
      "languages": ["English", "普通话"],
      "yearsExperience": 18,
      "rating": {
        "overall": 8.1,
        "difficulty": 5.5,
        "friendliness": 8.8,
        "clarity": null,
        "grading": "lenient",
        "reviewsCount": 124
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**Examples:**

```bash
# Get all teachers (first page)
curl http://localhost:8000/api/teachers/

# Search teachers
curl http://localhost:8000/api/teachers/?q=Wang

# Sort by rating
curl http://localhost:8000/api/teachers/?ordering=-rating_overall

# Paginate with custom size
curl http://localhost:8000/api/teachers/?page=2&page_size=50
```

### 2. Get Teacher Detail (获取教师详情)

```
GET /api/teachers/{id}/
```

**Path Parameters:**

- `id`: Teacher UUID

**Response:** Teacher 对象 (同上)

**Example:**

```bash
curl http://localhost:8000/api/teachers/tch_3b9d6a54-3a5a-4e58-9e3d-1b2c4f5a6d71/
```

### 3. Get Teacher Courses (获取教师课程)

```
GET /api/teachers/{id}/courses/
```

**Path Parameters:**

- `id`: Teacher UUID

**Response:** TeacherCourseRef 数组

```json
[
  {
    "subjectId": "uuid-string",
    "subjectCode": "APSS1A01",
    "title": "Introduction to Social Sciences"
  }
]
```

**Example:**

```bash
curl http://localhost:8000/api/teachers/tch_3b9d6a54-3a5a-4e58-9e3d-1b2c4f5a6d71/courses/
```

## Serializers (序列化器)

### TeacherSerializer

映射 Teacher 模型到前端 camelCase 格式。

**特殊字段:**

- `rating`: 使用 `SerializerMethodField` 聚合评分指标

### TeacherCourseRefSerializer

轻量级课程引用序列化器，用于 `/teachers/{id}/courses/` 端点。

## Views (视图)

### TeacherViewSet

只读视图集 (ReadOnlyModelViewSet)

**Features:**

- 分页支持 (TeacherPagination: 默认 20 条/页, 最大 100 条/页)
- 搜索功能 (SearchFilter: name, department)
- 排序功能 (OrderingFilter: name, department, rating_overall, rating_reviews_count, updated_at)
- 自定义搜索 (支持通过 `?q=` 参数搜索)
- 性能优化 (在 courses 端点使用 `.only()` 优化查询)

**Custom Actions:**

- `courses`: 获取教师教授的课程列表

**Permissions:**

- `AllowAny`: 所有用户可读

## Integration with Courses (与课程模块集成)

Teacher 模型通过 **M2M (Many-to-Many)** 关系与 Course 模型关联：

```python
# courses/models.py
class Course(models.Model):
    teachers = models.ManyToManyField('teachers.Teacher', related_name='courses', blank=True)
```

这允许：

- 一个教师可以教授多门课程
- 一门课程可以有多个教师
- 通过 `teacher.courses.all()` 获取教师的所有课程
- 通过 `course.teachers.all()` 获取课程的所有教师

## Admin (管理后台)

### TeacherAdmin

Django Admin 配置:

**List Display:**

- name, department, title, rating_overall, rating_reviews_count, updated_at

**Filters:**

- department, title, rating_grading

**Search:**

- name, department

**Read-only:**

- created_at, updated_at

## Frontend Integration (前端集成)

### API Layer

`src/lib/api/teachers.ts` 提供以下函数：

```typescript
// 获取单个教师
fetchTeacherById(teacherId: string): Promise<Teacher | null>

// 获取教师课程
fetchTeacherCourses(teacherId: string): Promise<TeacherCourseRef[]>

// 分页获取教师列表
fetchTeachers(params?: {
  q?: string;
  page?: number;
  pageSize?: number;
  ordering?: string;
}): Promise<PaginatedResponse<Teacher>>

// 简化搜索
searchTeachers(query: string): Promise<Teacher[]>
```

### Pages (页面)

1. **教师列表页** (`/app/teachers/page.tsx`)

   - 搜索和筛选
   - 排序 (姓名、评分、评价数、院系、更新时间)
   - 无限滚动分页
   - 响应式网格布局

2. **教师详情页** (`/app/teachers/[teacherId]/page.tsx`)
   - 显示完整教师信息
   - 联系方式卡片
   - 授课课程列表
   - 响应式设计

### Components (组件)

- `TeacherPreviewCard`: 教师卡片组件 (用于列表页)
  - 显示头像、姓名、职称、院系
  - 显示评分和评价数
  - 显示标签 (最多 3 个)
  - 显示授课语言

## Rating System (评分系统)

### 自动更新机制

教师评分系统与课程评价系统深度集成，实现了自动更新机制：

#### 触发时机

教师的 `rating_overall` 和 `rating_reviews_count` 会在以下情况自动重新计算：

1. **创建课程评价时** (`CourseReviewViewSet.perform_create`)
2. **更新课程评价时** (`CourseReviewViewSet.perform_update`)
3. **删除课程评价时** (`CourseReviewViewSet.perform_destroy`)

#### 计算逻辑

```python
# 伪代码示例
def recompute_teacher_aggregates(teacher):
    # 获取该教师所教授的所有课程的所有评价
    reviews = CourseReview.objects.filter(
        course__teachers=teacher,
        only_text=False  # 只统计带评分的评价
    )

    # 计算平均分和评价数
    avg_rating = reviews.aggregate(Avg('overall_rating'))
    count = reviews.count()

    # 更新教师记录
    teacher.rating_overall = round(avg_rating, 1) if count > 0 else None
    teacher.rating_reviews_count = count
    teacher.save()
```

#### 实现文件

- `teachers/utils.py`: `recompute_teacher_aggregates()` 函数
- `courses/views.py`: `_recompute_teachers_aggregates()` 调用封装

#### 并发安全

所有评分更新操作都在数据库事务中执行，确保数据一致性。

## TODO (待完成功能)

### High Priority (高优先级)

- [ ] 创建 seed 数据迁移 (`0002_seed_demo_teachers.py`)
- [x] ~~实现教师评价系统~~ (已通过课程评价自动聚合实现)
- [ ] 在导航栏添加 Teachers 链接

### Medium Priority (中优先级)

- [ ] 增强搜索 (支持 tags 和 languages JSON 字段搜索)
- [ ] 添加 django-filter 支持高级筛选
- [ ] 教师对比功能
- [ ] 教师关注功能

### Low Priority (低优先级)

- [ ] 批量导入教师功能 (Django Admin)
- [ ] 教师照片上传
- [ ] 教师排行榜
- [ ] 相似教师推荐

## Migration History (迁移历史)

- `0001_initial.py`: 创建 Teacher 表及索引

## Notes (注意事项)

1. **UUID 主键**: Teacher 使用 UUID 而非自增 ID，确保在分布式系统中的唯一性
2. **JSON 字段**: `tags` 和 `languages` 使用 JSON 字段存储数组，注意不同数据库的支持情况
3. **Rating 自动计算**: `rating_overall` 和 `rating_reviews_count` 由系统自动计算，无需手动维护
   - 基于该教师所有课程的评价自动聚合
   - 在课程评价创建/更新/删除时自动触发更新
   - 无评价时 `rating_overall` 为 `null`
4. **M2M 关系**: Teacher-Course 使用 M2M 关系，确保数据一致性
5. **性能优化**: 列表查询已添加分页和索引，大数据量时考虑添加缓存
   - 评分更新使用高效的聚合查询
   - 所有操作包裹在数据库事务中

## Testing (测试)

当前状态: ❌ 缺少测试

建议添加:

- 模型单元测试
- 序列化器测试
- ViewSet 测试 (list, retrieve, courses action)
- API 集成测试
- 前端组件测试
