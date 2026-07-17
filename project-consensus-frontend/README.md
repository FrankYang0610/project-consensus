## project-consensus-frontend

### Getting Started

Please ensure you have Node.js 20.19+, 22.13+, or 24+ and `npm` on your system. Then you can deploy the frontend locally according to the following steps.

#### 1. **Clone the repository** (if you haven't already):
```bash
git clone https://github.com/FrankYang0610/project-consensus/
cd project-consensus-frontend
```

#### 2. **Install dependencies**:
```bash
npm install
```

#### 3. **Set up shadcn/ui components** (if not already configured):
```bash
npx shadcn@latest init
```

#### 4. **Running the Development Server**

Start the development server with one of the following commands:

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000). Open this URL in your browser to view the application.



### Directory Structure

```
project-consensus-frontend/
├── src/
│   ├── app/                                  # Next.js App Router Pages
│   │   ├── page.tsx                          # Home page with course listings
│   │   ├── layout.tsx                        # Root layout with global providers
│   │   ├── globals.css                       # Global styles and Tailwind CSS
│   │   ├── not-found.tsx                     # 404 error page
│   │   ├── about/
│   │   │   └── page.tsx                      # About page
│   │   ├── courses/
│   │   │   ├── page.tsx                      # Course listing page
│   │   │   ├── [courseId]/
│   │   │   │   ├── page.tsx                  # Dynamic course detail pages
│   │   │   │   └── review/
│   │   │   │       └── page.tsx              # Course review page
│   │   │   ├── advanced-search/
│   │   │   │   └── page.tsx                  # Advanced course search page
│   │   │   └── latest-reviews/
│   │   │       └── page.tsx                  # Latest course reviews page
│   │   ├── post/
│   │   │   ├── [postId]/
│   │   │   │   ├── page.tsx                  # Dynamic forum post detail pages
│   │   │   │   └── not-found.tsx             # Post not found page
│   │   │   └── new/
│   │   │       └── page.tsx                  # Create new forum post page
│   │   ├── profile/
│   │   │   └── page.tsx                      # User profile page
│   │   ├── register/
│   │   │   └── page.tsx                      # User registration page
│   │   ├── settings/
│   │   │   └── page.tsx                      # User settings page
│   │   ├── teachers/
│   │   │   ├── page.tsx                      # Teachers listing page
│   │   │   └── [teacherId]/
│   │   │       └── page.tsx                  # Dynamic teacher detail pages
│   │   ├── user/
│   │   │   └── [userId]/
│   │   │       └── page.tsx                  # Dynamic user profile pages
│   │   ├── notifications/
│   │   │   └── page.tsx                      # Notifications page
│   │   ├── search/
│   │   │   ├── page.tsx                      # Global search results page
│   │   │   └── SEARCH_FEATURE.md             # Search feature documentation
│   │   ├── forgot-password/
│   │   │   └── page.tsx                      # Password reset request page
│   │   ├── reset-password/
│   │   │   └── page.tsx                      # Password reset page
│   │   ├── welcome/
│   │   │   └── page.tsx                      # Welcome page
│   │   ├── tos/
│   │   │   └── page.tsx                      # Terms of Service page
│   │   └── wiki/
│   │       ├── layout.tsx                    # Wiki shared layout with sidebar
│   │       ├── page.tsx                      # Wiki index page
│   │       ├── [slug]/
│   │       │   └── page.tsx                  # Dynamic wiki page detail
│   │       └── categories/
│   │           └── page.tsx                  # Wiki categories listing
│   │
│   ├── components/                           # Reusable UI Components
│   │   ├── SiteNavigation.tsx                # Main navigation component
│   │   ├── UserMenu.tsx                      # User dropdown menu
│   │   ├── LoginModal.tsx                    # Authentication modal (global)
│   │   ├── SearchBar.tsx                     # Global search functionality
│   │   ├── SearchResultCard.tsx              # Search result card component
│   │   ├── ThemeProvider.tsx                 # Dark/light theme context
│   │   ├── ThemeToggle.tsx                   # Theme switcher button
│   │   ├── Watermark.tsx                     # Watermark overlay component
│   │   ├── ClientOnlyTime.tsx                # Client-side time display
│   │   ├── TagManager.tsx                    # Tag management component
│   │   ├── InlineTagManager.tsx              # Inline tag management component
│   │   ├── AvatarUpload.tsx                  # Avatar upload component
│   │   ├── NotificationBell.tsx              # Notification bell component
│   │   │
│   │   ├── # Course Components
│   │   ├── CoursePreviewCard.tsx             # Course preview cards for listings
│   │   ├── CourseDetailCard.tsx              # Detailed course information cards
│   │   ├── CourseBackgroundCard.tsx          # Background cards for course sections
│   │   ├── CourseFilterBar.tsx               # Course filtering and sorting controls
│   │   ├── CourseReviewCard.tsx              # Individual course review cards
│   │   ├── CourseReviewPreviewCard.tsx       # Course review preview cards
│   │   └── CourseReviewReplyCard.tsx         # Course review reply cards
│   │   │
│   │   ├── # Forum Components
│   │   ├── ForumPostPreviewCard.tsx          # Forum post preview cards
│   │   ├── ForumPostDetailCard.tsx           # Detailed forum post view
│   │   ├── ForumPostCommentCard.tsx          # Individual comment component
│   │   ├── ForumPostCommentComposer.tsx      # Comment composition component
│   │   ├── ForumPostCommentList.tsx          # Comment list container
│   │   ├── ForumFilterBar.tsx                # Forum filtering controls
│   │   └── CreateForumPostButton.tsx         # New post creation button
│   │   │
│   │   ├── # Teacher Components
│   │   └── TeacherPreviewCard.tsx            # Teacher preview cards
│   │   │
│   │   ├── # Wiki Components
│   │   ├── wiki/
│   │   │   ├── MarkdownRenderer.tsx          # Markdown/MDX renderer component
│   │   │   ├── MdxComponents.tsx             # MDX element/component mapping
│   │   │   ├── WikiSidebar.tsx               # Wiki sidebar navigation
│   │   │   ├── WikiToc.tsx                   # Table of Contents component
│   │   │   ├── WikiPageList.tsx              # Wiki page list component
│   │   │   ├── WikiCategoryList.tsx          # Wiki category list component
│   │   │   ├── WikiLanguageSwitcher.tsx      # Wiki language switcher
│   │   │   ├── WikiPageHeader.tsx            # Wiki page header component
│   │   │   └── README.md                     # Wiki component documentation
│   │   │
│   │   ├── RichTextEditor/                   # Custom rich text editor
│   │   │   ├── RichTextEditor.tsx            # Main editor component
│   │   │   ├── RichTextEditor.module.css     # Editor-specific styles
│   │   │   └── index.ts                      # Export file
│   │   │
│   │   └── ui/                               # shadcn/ui Components
│   │       ├── accordion.tsx                 # Accordion component
│   │       ├── alert.tsx                     # Alert notification components
│   │       ├── badge.tsx                     # Badge components
│   │       ├── button.tsx                    # Button component variants
│   │       ├── card.tsx                      # Card layout components
│   │       ├── checkbox.tsx                  # Checkbox components
│   │       ├── dialog.tsx                    # Modal dialog components
│   │       ├── dropdown-menu.tsx             # Dropdown menu components
│   │       ├── input.tsx                     # Form input components
│   │       ├── label.tsx                     # Form label components
│   │       └── navigation-menu.tsx           # Navigation menu components
│   │
│   ├── contexts/                             # React Context Providers
│   │   ├── AppContext.tsx                    # Global application state management
│   │   └── README-APP.md                     # Context documentation
│   │
│   ├── hooks/                                # Custom React Hooks
│   │   ├── use-debounce.ts                   # Debouncing hook for search/input
│   │   ├── use-i18n.ts                       # Internationalization hook
│   │   └── use-infinite-list.ts              # Infinite scroll pagination hook
│   │
│   ├── lib/                                  # Utility Libraries
│   │   ├── api/                              # API Client Functions
│   │   │   ├── api-utils.ts                  # Common API utilities
│   │   │   ├── error-utils.ts                # API error handling utilities
│   │   │   ├── course.ts                     # Course API functions
│   │   │   ├── forum-comment.ts              # Forum comment API functions
│   │   │   ├── forum-post.ts                 # Forum post API functions
│   │   │   ├── teacher.ts                    # Teacher API functions
│   │   │   ├── notification.ts               # Notification API functions
│   │   │   ├── public-user.ts                # Public user API functions
│   │   │   ├── search.ts                     # Global search API functions
│   │   │   ├── site-stats.ts                 # Site statistics API functions
│   │   │   ├── user-activity.ts              # User activity API functions
│   │   │   ├── user-profile.ts               # User profile API functions
│   │   │   └── wiki.ts                       # Wiki API functions
│   │   ├── utils.ts                          # General utility functions
│   │   ├── course-utils.ts                   # Course-specific utility functions
│   │   ├── dept-display-utils.ts             # Department display utilities
│   │   ├── time-utils.ts                     # Time formatting utilities
│   │   ├── html-utils.ts                     # HTML processing utilities
│   │   ├── markdown.ts                       # Markdown processing utilities
│   │   ├── search-utils.ts                   # Search utility functions
│   │   ├── i18n.ts                           # Internationalization configuration
│   │   └── locale.ts                         # Locale management utilities
│   │
│   ├── types/                                # TypeScript Type Definitions
│   │   ├── index.ts                          # Main type exports
│   │   ├── app-types.ts                      # Application-wide type definitions
│   │   ├── course.ts                         # Course-related type definitions
│   │   ├── forum.ts                          # Forum and post type definitions
│   │   ├── teacher.ts                        # Teacher-related type definitions
│   │   ├── user.ts                           # User-related type definitions
│   │   ├── search.ts                         # Search-related type definitions
│   │   ├── validation.ts                     # Validation type definitions
│   │   ├── wiki.ts                           # Wiki-related type definitions
│   │   └── api/                              # API Type Definitions
│   │       ├── index.ts                      # API types export
│   │       ├── account.ts                    # Account API types
│   │       ├── common.ts                     # Common API types
│   │       ├── course.ts                    # Course API types
│   │       ├── forum-comment.ts              # Forum comment API types
│   │       ├── forum-post.ts                 # Forum post API types
│   │       ├── notification.ts               # Notification API types
│   │       └── teacher.ts                    # Teacher API types
│   │
│   ├── data/                                 # Sample Data
│   │   ├── sample-courses.ts                 # Mock course data
│   │   ├── sample-posts.ts                   # Mock forum post data
│   │   ├── sample-comments.ts                # Mock comment data
│   │   ├── sample-reviews.ts                 # Mock review data
│   │   ├── sample-review-replies.ts          # Mock review reply data
│   │   ├── sample-teachers.ts                # Mock teacher data
│   │   └── sample-curriculum.ts              # Mock curriculum data
│   │
│   └── locales/                              # Internationalization Files
│       ├── en-us.json                        # English (US) translations
│       ├── zh-cn.json                        # Chinese (Simplified) translations
│       ├── zh-hk.json                        # Chinese (Traditional) translations
│       └── README.md                         # i18n documentation
│
├── public/
│   └── project-consensus-icon.svg            # Project icon
│
├── components.json                           # shadcn/ui configuration
├── eslint.config.mjs                         # ESLint configuration
├── next.config.ts                            # Next.js configuration
├── next-env.d.ts                             # Next.js TypeScript definitions
├── package.json                              # Project dependencies
├── package-lock.json                         # Dependency lock file
├── postcss.config.mjs                        # PostCSS configuration
├── tsconfig.json                             # TypeScript configuration
├── tsconfig.tsbuildinfo                      # TypeScript build cache
└── README.md                                 # Project documentation
```
