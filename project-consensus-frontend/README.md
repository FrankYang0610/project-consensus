## project-consensus-frontend

### Getting Started

This guide will help you set up and run the project-consensus frontend application on your local development environment.

#### Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js** (version 18.0 or higher) - [Download here](https://nodejs.org/)
- **npm**, **yarn**, **pnpm**, or **bun** package manager
- **Git** for version control

#### Installation

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone https://github.com/FrankYang0610/project-consensus/
   cd project-consensus-frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   # or
   bun install
   ```

3. **Set up shadcn/ui components** (if not already configured):
   ```bash
   npx shadcn@latest init
   ```

4. **Install additional dependencies** (if needed):
   ```bash
   npm install i18next react-i18next i18next-browser-languagedetector
   ```

#### Running the Development Server

Start the development server with one of the following commands:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

The application will be available at [http://localhost:3000](http://localhost:3000). Open this URL in your browser to view the application.

#### Development Features

- **Hot Reload**: The page automatically updates as you edit files
- **TypeScript**: Full type checking and IntelliSense support
- **ESLint**: Code linting for better code quality
- **Tailwind CSS**: Utility-first CSS framework for styling

#### Making Changes

- **Main page**: Edit `src/app/page.tsx` to modify the home page
- **Components**: Add or modify components in the `src/components/` directory
- **Styling**: Update global styles in `src/app/globals.css`
- **Internationalization**: Add translations in the `src/locales/` directory

#### Additional Resources

- **shadcn/ui Documentation**: [ui.shadcn.com/docs](https://ui.shadcn.com/docs) - Learn about the UI components used in this project
- **Next.js Font Optimization**: This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a modern font family from Vercel

### Project Architecture

This is a Next.js 14+ frontend application built with TypeScript, featuring a modern course review and forum platform. The project follows Next.js App Router architecture with a component-based design.

#### Core Technologies
- **Next.js 14+** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** for UI components
- **i18next** for internationalization
- **React** with modern hooks

#### Directory Structure

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
│   │   │   └── [subjectId]/
│   │   │       ├── page.tsx                  # Dynamic course detail pages
│   │   │       └── review/
│   │   │           └── page.tsx              # Course review page
│   │   ├── post/
│   │   │   ├── [postId]/
│   │   │   │   └── page.tsx                  # Dynamic forum post detail pages
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
│   │   └── tos/
│   │       └── page.tsx                      # Terms of Service page
│   │
│   ├── components/                           # Reusable UI Components
│   │   ├── SiteNavigation.tsx                # Main navigation component
│   │   ├── UserMenu.tsx                      # User dropdown menu
│   │   ├── LoginModal.tsx                    # Authentication modal (global)
│   │   ├── SearchBar.tsx                     # Global search functionality
│   │   ├── ThemeProvider.tsx                 # Dark/light theme context
│   │   ├── ThemeToggle.tsx                   # Theme switcher button
│   │   ├── Watermark.tsx                     # Watermark overlay component
│   │   ├── ClientOnlyTime.tsx                # Client-side time display
│   │   ├── PronounsSelector.tsx              # Pronouns selection component
│   │   ├── TagManager.tsx                    # Tag management component
│   │   │
│   │   ├── # Course Components
│   │   ├── CoursePreviewCard.tsx             # Course preview cards for listings
│   │   ├── CourseDetailCard.tsx              # Detailed course information cards
│   │   ├── CourseBackgroundCard.tsx          # Background cards for course sections
│   │   ├── CourseFilterBar.tsx               # Course filtering and sorting controls
│   │   ├── CourseReviewCard.tsx              # Individual course review cards
│   │   └── CourseReviewReplyCard.tsx         # Course review reply cards
│   │   │
│   │   ├── # Forum Components
│   │   ├── ForumPostPreviewCard.tsx          # Forum post preview cards
│   │   ├── ForumPostDetailCard.tsx           # Detailed forum post view
│   │   ├── ForumPostCommentCard.tsx          # Individual comment component
│   │   ├── ForumPostCommentComposer.tsx      # Comment composition component
│   │   ├── ForumPostCommentList.tsx          # Comment list container
│   │   └── CreateForumPostButton.tsx         # New post creation button
│   │   │
│   │   ├── # Teacher Components
│   │   └── TeacherPreviewCard.tsx            # Teacher preview cards
│   │   │
│   │   ├── RichTextEditor/                   # Custom rich text editor
│   │   │   ├── RichTextEditor.tsx            # Main editor component
│   │   │   ├── RichTextEditor.module.css     # Editor-specific styles
│   │   │   └── index.ts                      # Export file
│   │   │
│   │   └── ui/                               # shadcn/ui Components
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
│   │   ├── useDebounce.ts                    # Debouncing hook for search/input
│   │   └── useI18n.ts                        # Internationalization hook
│   │
│   ├── lib/                                  # Utility Libraries
│   │   ├── api/                              # API Client Functions
│   │   │   ├── api-utils.ts                  # Common API utilities
│   │   │   ├── courses.ts                    # Course API functions
│   │   │   ├── forum-comment.ts              # Forum comment API functions
│   │   │   ├── forum-post.ts                 # Forum post API functions
│   │   │   └── teachers.ts                   # Teacher API functions
│   │   ├── utils.ts                          # General utility functions
│   │   ├── course-utils.ts                   # Course-specific utility functions
│   │   ├── time-utils.ts                     # Time formatting utilities
│   │   ├── html-utils.ts                     # HTML processing utilities
│   │   ├── i18n.ts                           # Internationalization configuration
│   │   ├── locale.ts                         # Locale management utilities
│   │   └── pronouns-utils.ts                 # Pronouns utilities and helpers
│   │
│   ├── types/                                # TypeScript Type Definitions
│   │   ├── index.ts                          # Main type exports
│   │   ├── app-types.ts                      # Application-wide type definitions
│   │   ├── course.ts                         # Course-related type definitions
│   │   ├── forum.ts                          # Forum and post type definitions
│   │   ├── teacher.ts                        # Teacher-related type definitions
│   │   ├── user.ts                           # User-related type definitions
│   │   └── api/                              # API Type Definitions
│   │       ├── index.ts                      # API types export
│   │       ├── accounts.ts                   # Account API types
│   │       ├── common.ts                     # Common API types
│   │       ├── courses.ts                    # Course API types
│   │       ├── forum-comment.ts              # Forum comment API types
│   │       ├── forum-post.ts                 # Forum post API types
│   │       └── teachers.ts                   # Teacher API types
│   │
│   ├── data/                                 # Sample Data
│   │   ├── sampleCourses.ts                  # Mock course data
│   │   ├── samplePosts.ts                    # Mock forum post data
│   │   ├── sampleComments.ts                 # Mock comment data
│   │   ├── sampleReviews.ts                  # Mock review data
│   │   ├── sampleReviewReplies.ts            # Mock review reply data
│   │   ├── sampleTeachers.ts                 # Mock teacher data
│   │   └── sampleCurriculum.ts               # Mock curriculum data
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

#### Key Features
1. **Multi-language Support** - Full internationalization with English and Chinese variants
2. **Course Management** - Browse, filter, and review courses with detailed course pages
3. **Forum System** - Create posts, comments, and discussions with rich text editing
4. **Teacher Directory** - Browse and review teachers with detailed profiles
5. **User Authentication** - Registration and login system with profile management
6. **Responsive Design** - Mobile-first responsive layout
7. **Dark/Light Theme** - Theme switching capability
8. **Rich Text Editing** - Custom CKEditor5-based rich text editor for content creation
9. **Search & Filtering** - Advanced search and filtering capabilities
10. **Comment System** - Nested comment system with reply functionality
11. **Tag Management** - Tag-based content organization
12. **API Integration** - Modular API client with TypeScript type safety

#### Development Workflow
The project uses modern React patterns with hooks, context for state management, and TypeScript for type safety. Components are organized by feature and reusability, with clear separation between UI components, business logic, and data management.

**Architecture Highlights:**
- **Modular API Layer**: Separate API client functions for each domain (courses, forum, teachers)
- **Type-Safe API**: Comprehensive TypeScript types for all API responses and requests
- **Component Organization**: Components grouped by feature (Course, Forum, Teacher, UI)
- **Custom Hooks**: Reusable hooks for common functionality (debouncing, i18n)
- **Context Management**: Global state management through React Context
- **Rich Text Editing**: CKEditor5 integration for content creation
- **Internationalization**: Multi-language support with i18next

#### Authentication Modal Design

- Global component: `LoginModal` is controlled by `AppContext` (`openLoginModal/closeLoginModal`)
- Typical gating usage:

```tsx
import { useApp } from '@/contexts/AppContext'

const { isLoggedIn, openLoginModal } = useApp()

function onAction() {
  if (!isLoggedIn) return openLoginModal()
  // proceed
}
```

#### API Structure

The project uses a modular API client architecture with separate modules for each domain:

**API Client Modules:**
- `lib/api/courses.ts` - Course-related API functions
- `lib/api/forum-post.ts` - Forum post API functions  
- `lib/api/forum-comment.ts` - Forum comment API functions
- `lib/api/teachers.ts` - Teacher-related API functions
- `lib/api/api-utils.ts` - Common API utilities and base functions

**Type Safety:**
- All API functions are fully typed with TypeScript
- API types are organized in `types/api/` directory
- Separate type files for each domain (accounts, courses, forum-comment, forum-post, teachers)
- Common types shared across modules in `types/api/common.ts`


### Appendix: Node.js Documentations

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

It's also recommended to check out [the Next.js GitHub repository](https://github.com/vercel/next.js).

#### Deploy on Vercel

The easiest way to deploy Next.js apps is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
