# Frontend Directory Structure Rules

This document defines placement rules for `frontend/src/lib` and `frontend/src/routes`.
Goal: keep route files thin and make file placement predictable before further refactors.

## Core boundaries

- `src/routes`: routing entrypoints only (`+page.svelte`, `+layout.svelte`, `+page.ts`, `+layout.ts`)
- `src/lib`: reusable app-internal modules (imported via `$lib`)
- `src/lib/server`: server-only modules reserved for secrets and server-only logic

Reference basis (SvelteKit docs):

- `src/routes` is public-facing app routes
- `src/lib` is internal library code
- `$lib/server` cannot be imported into client code

## Placement rules

1. Feature logic

- Path: `src/lib/features/<feature>/...`
- Includes: state transitions, pure domain logic, mappers, feature-scoped storage helpers
- Excludes: page-level routing concerns and direct markup composition

2. UI components

- Path: `src/lib/components/<feature>/...`
- Includes: Svelte components reusable across routes in the same feature
- Excludes: data access policy decisions (repo selection, env-based switching)

3. Data access

- Path: `src/lib/data/...`
- Includes: repositories, API/local adapters, DTO conversion
- Current placement:
  - `src/lib/data/tasks/repo.ts`
  - `src/lib/data/tasks/repoApi.ts`
  - `src/lib/data/tasks/repoLocal.ts`

4. App stores

- Path: `src/lib/stores/...`
- Includes: cross-route app stores and store orchestration
- Current placement: `src/lib/stores/tasksStore.ts`

5. Shared utilities

- Path: `src/lib/shared/...`
- Includes: cross-feature helpers such as env and polling utilities
- Current placement:
  - `src/lib/shared/env.ts`
  - `src/lib/shared/polling.ts`
  - `src/lib/shared/pollingSettings.ts`

6. Static assets

- Path: `src/lib/assets/...`
- Includes: library-local static assets used by components

## Route file rule

Route files should be composition-first:

- import feature modules/components
- wire inputs/outputs
- avoid accumulating feature internals in one route file

If a route file exceeds this role, extract logic into `src/lib/features/<feature>/...` first.

## Step 3 decisions applied

- Admin pages are canonical at `/admin/projects` and `/admin/users`
- Legacy duplicate route paths were removed in Step 2
- This document is the source of truth for file placement in upcoming refactors
