# Global Search Feature Documentation

## Overview

The global search feature has been implemented, supporting search across the following content types:

- Course
- Forum Post
- Forum Comment
- Course Review
- Wiki Page
- Teacher
- User ⭐

## Feature Highlights

### 1. Real-time Search Suggestions ⭐

- Automatically displays top 5 suggestions when typing in the navigation search box
- Supports keyboard navigation (arrow keys for selection, Enter to confirm)
- Press Esc key to close the suggestion dropdown
- Shows result type tags and summary information
- **Keyword Highlighting**: Automatically highlights matching keywords in suggestion titles and summaries
- **Open in New Tab**: Clicking suggestions or pressing Enter opens results in new tabs
- **Rich Text Processing**: Automatically cleans HTML tags to display plain text

### 2. Complete Search Results Page

- URL: `/search?q={search_query}`
- Supports filtering by type (All, Course, Post, Comment, Review, Wiki, Teacher, User)
- **Incremental Pagination**: Click "Load More" button to append new results instead of replacing (consistent with forum and course review)
- **Infinite Scroll Support**: Automatically detects when user scrolls to bottom and loads more content
- Displays total results count and currently loaded count
- **Open in New Tab**: All search results open in new tabs
- **Home Button**: Quick return to homepage button at the top of the page
- **Color Differentiation**: Posts (green) and comments (orange) use different colors for quick identification
- **Result Deduplication**: Automatically removes duplicates to avoid showing the same content multiple times

### 3. Search Keyword Highlighting ⭐

- Automatically highlights search keywords in result titles and summaries
- Uses yellow background to mark matching text
- Case-insensitive matching

### 4. Rich Text Content Processing ⭐

- Automatically cleans HTML tags to display plain text summaries
- Preserves content readability
- Applicable to rich text content like forum posts and comments
- Applied to both search suggestions and search results pages
- SSR Safe (Server-Side Rendering compatible)

### 5. Multi-language Support

- Simplified Chinese (zh-CN)
- Traditional Chinese (zh-HK)
- English (en-US)

### 6. Privacy Protection 🔒

**Anonymous Publishing Protection Mechanism**:

The system strictly protects the privacy of anonymous users:

- ✅ **Allowed**: Anonymous content can be searched by title and body content (content itself is public)
- ❌ **Forbidden**: Anonymous content **cannot** be searched by author nickname
- 🔐 **Implementation**: In search queries, author nickname search conditions only apply to content with `is_anonymous=False`

This ensures:

1. Cannot discover anonymous posts by searching a user's nickname
2. Anonymous user identities won't be exposed through search functionality
3. Publicly posted content is normally searchable, anonymous posted content remains identity-confidential

## API Interfaces

### Backend API

**Endpoint:** `GET /api/search/`

**Parameters:**

- `q` (required): Search keywords
- `page` (optional): Page number, default 1
- `page_size` (optional): Results per page, default 20, maximum 100
- `types` (optional): Comma-separated type list, e.g., `course,forum_post,wiki,user`

**Response Format:**

```json
{
  "results": [
    {
      "type": "course|forum_post|forum_comment|course_review|wiki|teacher",
      "id": "uuid",
      "title": "Title",
      "snippet": "Summary snippet",
      "url": "Frontend route",
      "metadata": {
        "parent_id": "...",
        "parent_title": "...",
        "author": "...",
        "created_at": "..."
      }
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 20
}
```

### Frontend API

**Function:** `searchGlobal(params, init?)`

- Complete search with pagination and type filtering support

**Function:** `searchSuggestions(query, limit?, init?)`

- Quick suggestion search, returns 5 results by default

## UI Design and Color Scheme

To help users quickly identify different types of search results, the system has designed unique color schemes for each content type:

| Content Type  | Color  | Description                                        |
| ------------- | ------ | -------------------------------------------------- |
| Course        | Blue   | Represents academics and knowledge                 |
| Forum Post    | Green  | Represents discussion and communication            |
| Forum Comment | Orange | Differentiates from posts, indicates reply content |
| Course Review | Amber  | Complements star ratings                           |
| Wiki Page     | Purple | Represents documentation and knowledge base        |
| Teacher       | Indigo | Represents educators                               |
| User          | Pink   | Represents community members                       |

Each search result card includes:

- **Type Icon**: Left-side icon with colored background
- **Type Tag**: Small colored tag showing content type
- **Title**: Bold display with keyword highlighting
- **Summary**: Gray text with keyword highlighting, HTML tags cleaned
- **Metadata**: Author, date, likes and other additional information

## Search Scope

### Course

Search Fields:

- `subject_code`: Course code
- `title`: Course title
- `department`: Offering department

### Forum Post

Search Fields:

- `title`: Post title
- `content`: Post content
- `author.profile.nickname`: Author nickname ⭐ (**only for non-anonymous posts**)

**Privacy Protection**: Anonymously published posts cannot be searched by author nickname, ensuring anonymous user privacy.

### Forum Comment

Search Fields:

- `content`: Comment content
- `author.profile.nickname`: Author nickname ⭐ (**only for non-anonymous comments**)

Display Format: `Commented on: {post_title}`

**Privacy Protection**: Anonymously published comments cannot be searched by author nickname, ensuring anonymous user privacy.

### Course Review

Search Fields:

- `content`: Review content
- `author.profile.nickname`: Author nickname ⭐ (**only for non-anonymous reviews**)

Display Format: `Reviewed: {course_code} {course_title}`

**Privacy Protection**: Anonymously published course reviews cannot be searched by author nickname, ensuring anonymous user privacy.

### Wiki Page

Search Fields:

- `title`: Page title
- `content`: Page content
- `summary`: Page summary
- `tags`: Tags
- `author.profile.nickname`: Author nickname ⭐

Only searches published pages (`status='published'`)

### Teacher

Search Fields:

- `name`: Teacher name
- `department`: Affiliated department
- `bio`: Personal biography

### User ⭐

Search Fields:

- `nickname`: User nickname

Display Information:

- User nickname
- Pronouns (if set)
- Number of forum posts
- Number of course reviews
- Link to user profile

## Testing Steps

### 1. Backend Testing

Start Django server:

```bash
cd project-consensus-backend
python manage.py runserver
```

Test API:

```bash
# Basic search
curl "http://localhost:8000/api/search/?q=python"

# With type filtering
curl "http://localhost:8000/api/search/?q=python&types=course,wiki"

# Pagination
curl "http://localhost:8000/api/search/?q=python&page=1&page_size=10"

# Test anonymous privacy protection (important!)
# Assuming user "Demo User" has anonymously published posts
# 1. Search for the user's nickname, should not return anonymous posts
curl "http://localhost:8000/api/search/?q=Demo%20User&types=forum_post"
# Expected: Only returns non-anonymous posts by this user

# 2. Search for anonymous post content keywords, should be able to find (but not show real author)
curl "http://localhost:8000/api/search/?q=anonymous_post_keywords&types=forum_post"
# Expected: Returns posts, but author shows as "Anonymous"
```

### 2. Frontend Testing

Start Next.js development server:

```bash
cd project-consensus-frontend
npm run dev
```

Testing Steps:

1. Visit `http://localhost:3000`
2. Type keywords in the navigation search box
3. Observe if suggestion dropdown appears
4. Press Enter or click "View All Results"
5. Verify search results page displays correctly
6. Test type filtering functionality
7. Test pagination loading

### 3. Keyboard Navigation Testing

1. Type keywords in search box
2. Press down arrow to select suggestions
3. Press up arrow to move up
4. Press Enter to confirm selected suggestion
5. Press Esc to close dropdown

### 4. Mobile Testing

1. Open browser developer tools
2. Switch to mobile device mode
3. Open mobile menu
4. Test search functionality

### 5. Privacy Protection Testing 🔒 (Important!)

**Test Privacy Protection for Anonymous Posts**:

1. **Prepare Test Data**:

   - Create a test user account (e.g., nickname "TestUser")
   - Publish some public posts with this account (`is_anonymous=False`)
   - Publish some anonymous posts with this account (`is_anonymous=True`)

2. **Test Scenario 1: Search User Nickname**

   - Type "TestUser" in search box
   - ✅ **Should See**: All public posts by TestUser
   - ❌ **Should Not See**: Anonymous posts by TestUser

3. **Test Scenario 2: Search Anonymous Post Content**

   - Remember special keywords from an anonymous post
   - Search for those keywords
   - ✅ **Should See**: The anonymous post
   - ✅ **Should Display**: Author as "Anonymous", not "TestUser"

4. **Test Scenario 3: Combined Search**

   - Search for user's nickname, filter by "Forum Comments" and "Course Reviews"
   - Verify only returns non-anonymous comments and reviews

5. **Verification Method**:
   ```bash
   # Backend API test
   # Assuming TestUser has anonymous post ID=1 and public post ID=2
   curl "http://localhost:8000/api/search/?q=TestUser"
   # Results should only include post ID=2, not ID=1
   ```

**Expected Results**:

- ✅ Cannot discover anonymous posts by searching user nickname
- ✅ Anonymous content itself can be found through content search, but author shows as "Anonymous"
- ✅ Privacy is fully protected

## Performance Optimization Suggestions

### Current Implementation

- ✅ Uses debounce to reduce API calls (500ms delay)
- ✅ Uses `select_related` to preload foreign keys avoiding N+1 queries
- ✅ Limits each query to maximum 50 results
- ✅ Frontend search suggestions limited to 5 results
- ✅ Uses `useInfiniteList` hook for efficient pagination loading (consistent with forum and course review)
- ✅ Supports both infinite scroll and manual "Load More" methods
- ✅ Automatic result deduplication (based on `type` and `id`)

### Future Optimization Directions

1. **Database Indexing**

   - Add full-text search indexes for search fields (PostgreSQL)
   - Use `GinIndex` or `GistIndex`

2. **Caching Strategy**

   - Cache popular search keyword results
   - Use Redis to cache search results
   - Set reasonable expiration time (e.g., 5 minutes)

3. **Search Ranking Optimization**

   - Implement more complex relevance scoring algorithms
   - Consider keyword position (title > summary > content)
   - Consider content popularity (views, likes)

4. **Full-text Search Engine**

   - Consider integrating Elasticsearch for more powerful search
   - Support pinyin search, fuzzy matching, synonyms

5. **Frontend Optimization**
   - Implement search result highlighting
   - Add search history
   - Support quick selection of search suggestions

## Known Limitations

1. Current search uses simple `__icontains` queries with limited Chinese word segmentation support
2. Search result relevance ranking is relatively simple, only prioritizing title matches
3. Search keyword highlighting not implemented
4. Does not support advanced search syntax (e.g., quoted exact matches, boolean operators)

## File List

### Backend

- `project-consensus-backend/core/views.py` - Search API implementation
- `project-consensus-backend/config/urls.py` - Route configuration

### Frontend

- `project-consensus-frontend/src/types/search.ts` - Type definitions
- `project-consensus-frontend/src/lib/api/search.ts` - API call functions
- `project-consensus-frontend/src/components/SearchBar.tsx` - Search bar component
- `project-consensus-frontend/src/components/SearchResultCard.tsx` - Result card component
- `project-consensus-frontend/src/app/search/page.tsx` - Search results page
- `project-consensus-frontend/src/locales/*.json` - Multi-language translations

## Maintenance Instructions

### Adding New Search Types

1. Add new model queries in the `search` function in backend `core/views.py`
2. Add new types to `SearchResultType` in frontend `types/search.ts`
3. Add new type icons and colors in `getTypeInfo` function in `SearchResultCard.tsx`
4. Add type labels in `getTypeLabel` function in `SearchBar.tsx`
5. Add translation keys in all three language files

### Modifying Search Logic

Modify corresponding model queries in `core/views.py`:

```python
# Example: Adding new search field
courses = Course.objects.filter(
    Q(subject_code__icontains=query) |
    Q(title__icontains=query) |
    Q(department__icontains=query) |
    Q(new_field__icontains=query)  # New field
).order_by('-last_updated')[:50]
```

## Contact Information

For questions or suggestions, please contact the development team.
