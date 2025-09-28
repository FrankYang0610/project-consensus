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
│   │   ├── LoginModal.tsx                    # Authentication modal (global)
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

### Appendix: Node.js Documentations

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

It's also recommended to check out [the Next.js GitHub repository](https://github.com/vercel/next.js).

#### Deploy on Vercel

The easiest way to deploy Next.js apps is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
