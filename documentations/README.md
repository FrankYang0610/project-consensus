## Documentations

Here is all the documentation needed for the development and maintenance of project‑consensus.

Before contributing to project-consensus, be sure to read the parts of the documentation below that relate to the changes you intend to make.

The documentation below also includes a lot of background knowledge on networking, databases, and security. You are welcome to read, revise, and correct it.

### Index

#### Background Knowledge
- [CSRF](./CSRF.md) — What CSRF is, how CSRF tokens work, and how this project applies Django's CSRF middleware with frontend token echoing.
- [Serializers, Views and Services](./SERIALIZERS-VIEWS-SERVICES.md) — Overview of serializer patterns, view conventions, and service layer architecture used across apps.

#### Core Documentation
- [Forum Posts and Comments](./FORUM-POSTS-AND-COMMENTS.md) — Data model and API behaviors for forum posts, comments, and related operations.
- [Forum Posts Filtering](./FORUM-POSTS-FILTERING.md) — Query parameters and examples for server-side filtering and pagination of forum posts.
- [Course Reviews and Replies](./COURSE-REVIEWS-AND-REPLIES.md) — Structure and endpoints for course reviews, ratings, and threaded replies.
- [Teacher Searching](./TEACHER-SEARCHING.md) — Splink-based approximate matching and robust fallback for teacher search (name/department/tags).
- [API Errors](./API-ERRORS.md) — Standardized error formats, error codes, and recommended client handling strategies.

#### Deployment Documentation
- [Beta Deployment (Chinese Simplified)](./beta/DEPLOYMENT-BETA.md) — Configuration and deployment instructions for the beta environment.
- [Preprod Deployment Settings (Chinese Simplified)](./preprod/PREPROD-DEPLOYMENT-SETTINGS.md) — Pre-production environment configuration and deployment settings.

### Conventions
- All documentation is written with Django REST Framework in mind for the backend and Next.js/TypeScript for the frontend.
- File names are kebab-cased for consistency. Cross-links are relative so they work both on GitHub and locally.
- When adding new docs, please include a short one-line summary at the top and link them here.

### How to Contribute
1. Create or update a `.md` file in this directory.
2. Add a concise description and examples where helpful.
3. Insert a link in the Index above in alphabetical or thematic order.
4. Keep terminology consistent with the codebase and existing documentation.


