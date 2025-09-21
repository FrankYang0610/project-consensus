## project-consensus-frontend

> This is a Next.js project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

### Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

### Shadcn UI components are used in this project. To learn more about documentation, please visit [shadcn/ui](https://ui.shadcn.com/docs).

```bash
# Install shadcn/ui
npx shadcn@latest init
# Install i18next
npm install i18next react-i18next i18next-browser-languagedetector

```

Open [http://localhost:3000](http://localhost:3000) with the browser to see the result.

One can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

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
│   │   │       └── page.tsx                  # Dynamic course detail pages
│   │   ├── post/
│   │   │   ├── [postId]/
│   │   │   │   └── page.tsx                  # Dynamic forum post detail pages
│   │   │   └── new/
│   │   │       └── page.tsx                  # Create new forum post page
│   │   ├── register/
│   │   │   └── page.tsx                      # User registration page
│   │   └── tos/
│   │       └── page.tsx                      # Terms of Service page
│   │
│   ├── components/                           # Reusable UI Components
│   │   ├── SiteNavigation.tsx                # Main navigation component
│   │   ├── UserMenu.tsx                      # User dropdown menu
│   │   ├── LoginComponent.tsx                # Authentication component
│   │   ├── SearchBar.tsx                     # Global search functionality
│   │   ├── ThemeProvider.tsx                 # Dark/light theme context
│   │   ├── ThemeToggle.tsx                   # Theme switcher button
│   │   ├── Watermark.tsx                     # Watermark overlay component
│   │   ├── ClientOnlyTime.tsx                # Client-side time display
│   │   │
│   │   ├── # Course Components
│   │   ├── CoursesPreviewCard.tsx            # Course preview cards for listings
│   │   ├── CoursesDetailedCard.tsx           # Detailed course information cards
│   │   ├── CoursesBackgroundCard.tsx         # Background cards for course sections
│   │   ├── CoursesFilterBar.tsx              # Course filtering and sorting controls
│   │   └── CourseReviewCard.tsx              # Individual course review cards
│   │   │
│   │   ├── # Forum Components
│   │   ├── ForumPostPreviewCard.tsx          # Forum post preview cards
│   │   ├── ForumPostDetailCard.tsx           # Detailed forum post view
│   │   ├── ForumPostComment.tsx              # Individual comment component
│   │   ├── ForumPostCommentList.tsx          # Comment list container
│   │   └── CreateForumPostButton.tsx         # New post creation button
│   │   │
│   │   ├── RichTextEditor/                   # Custom rich text editor
│   │   │   ├── RichTextEditor.tsx            # Main editor component
│   │   │   ├── RichTextEditor.module.css     # Editor-specific styles
│   │   │   └── index.ts                      # Export file
│   │   │
│   │   └── ui/                               # shadcn/ui Components
│   │       ├── button.tsx                    # Button component variants
│   │       ├── card.tsx                      # Card layout components
│   │       ├── input.tsx                     # Form input components
│   │       ├── label.tsx                     # Form label components
│   │       ├── dialog.tsx                    # Modal dialog components
│   │       ├── alert.tsx                     # Alert notification components
│   │       ├── dropdown-menu.tsx             # Dropdown menu components
│   │       └── navigation-menu.tsx           # Navigation menu components
│   │
│   ├── contexts/                             # React Context Providers
│   │   ├── AppContext.tsx                    # Global application state management
│   │   └── README-APP.md                     # Context documentation
│   │
│   ├── hooks/                                # Custom React Hooks
│   │   └── useI18n.ts                        # Internationalization hook
│   │
│   ├── lib/                                  # Utility Libraries
│   │   ├── utils.ts                          # General utility functions
│   │   ├── course-utils.ts                   # Course-specific utility functions
│   │   ├── time-utils.ts                     # Time formatting utilities
│   │   ├── html-utils.ts                     # HTML processing utilities
│   │   ├── i18n.ts                           # Internationalization configuration
│   │   └── locale.ts                         # Locale management utilities
│   │
│   ├── types/                                # TypeScript Type Definitions
│   │   ├── index.ts                          # Main type exports
│   │   ├── app-types.ts                      # Application-wide type definitions
│   │   ├── course.ts                         # Course-related type definitions
│   │   ├── forum.ts                          # Forum and post type definitions
│   │   └── user.ts                           # User-related type definitions
│   │
│   ├── data/                                 # Sample Data
│   │   ├── sampleCourses.ts                  # Mock course data
│   │   ├── samplePosts.ts                    # Mock forum post data
│   │   ├── sampleComments.ts                 # Mock comment data
│   │   └── sampleReviews.ts                  # Mock review data
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
2. **Course Management** - Browse, filter, and review courses
3. **Forum System** - Create posts, comments, and discussions
4. **User Authentication** - Registration and login system
5. **Responsive Design** - Mobile-first responsive layout
6. **Dark/Light Theme** - Theme switching capability
7. **Rich Text Editing** - Custom rich text editor for content creation

#### Development Workflow
The project uses modern React patterns with hooks, context for state management, and TypeScript for type safety. Components are organized by feature and reusability, with clear separation between UI components, business logic, and data management.

### Appendix: Node.js Documentations

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

It's also recommended to check out [the Next.js GitHub repository](https://github.com/vercel/next.js).

#### Deploy on Vercel

The easiest way to deploy Next.js apps is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
