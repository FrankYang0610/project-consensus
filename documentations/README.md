## Project Documentation

This folder contains documentation for key backend and frontend concepts used in Project Consensus. Use the links below to navigate.

### Index

#### Core Documentation
- [Serializers, Views and Services](./SERIALIZERS-VIEWS-SERVICES.md) — Overview of serializer patterns, view conventions, and service layer architecture used across apps.
- [Forum Posts and Comments](./FORUM-POSTS-AND-COMMENTS.md) — Data model and API behaviors for forum posts, comments, and related operations.
- [Forum Posts Filtering](./FORUM-POSTS-FILTERING.md) — Query parameters and examples for server-side filtering and pagination of forum posts.
- [Course Reviews and Replies](./COURSE-REVIEWS-AND-REPLIES.md) — Structure and endpoints for course reviews, ratings, and threaded replies.
- [API Errors](./API-ERRORS.md) — Standardized error formats, error codes, and recommended client handling strategies.

#### Deployment Documentation
- [Beta Deployment (Chinese Simplified)](./beta/DEPLOYMENT-BETA.md) — Configuration and deployment instructions for the beta environment.
- [Preprod Deployment Settings (Chinese Simplified)](./preprod/PREPROD-DEPLOYMENT)-SETTINGS.md) — Pre-production environment configuration and deployment settings.

### Conventions
- All documentation is written with Django REST Framework in mind for the backend and Next.js/TypeScript for the frontend.
- File names are kebab-cased for consistency. Cross-links are relative so they work both on GitHub and locally.
- When adding new docs, please include a short one-line summary at the top and link them here.

### How to Contribute
1. Create or update a `.md` file in this directory.
2. Add a concise description and examples where helpful.
3. Insert a link in the Index above in alphabetical or thematic order.
4. Keep terminology consistent with the codebase and existing documentation.


