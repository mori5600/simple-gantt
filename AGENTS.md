# AGENTS.md

## Purpose
This file defines practical working rules for coding agents in this repository.

## Repository Overview
- Monorepo managed by `pnpm workspace`
- Main packages:
  - `frontend`: SvelteKit app (UI)
  - `backend`: Hono + Prisma API
  - `shared`: shared schemas/types (`@simple-gantt/shared`)
- Prisma schema: `prisma/schema.prisma`

## Setup
```sh
pnpm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## Common Commands
- Development:
  - `pnpm dev`
  - `pnpm frontend:dev`
  - `pnpm backend:dev`
- Quality:
  - `pnpm lint`
  - `pnpm format`
  - `pnpm test`
- Prisma:
  - `pnpm prisma:generate`
  - `pnpm prisma:push`
  - `pnpm prisma:seed`

## Agent Working Rules
- Keep changes minimal and scoped to the request.
- Prefer editing the smallest set of files needed.
- Do not revert user-authored changes unrelated to your task.
- Follow existing style and formatting (run formatter/lint only when needed).
- If behavior changes, update docs/tests in the same change when possible.

## Frontend Notes
- Main route files are under `frontend/src/routes`.
- Gantt-related UI and logic are under `frontend/src/lib/components/gantt` and `frontend/src/lib/features/gantt`.
- When changing UI behavior, prefer adding/updating tests near changed modules.

## Backend Notes
- API entry: `backend/src/index.ts`
- App wiring: `backend/src/app.ts`
- Route/controller/usecase layers are separated under `backend/src`.
- Data model changes should be reflected in Prisma schema and seed if necessary.

## Shared Package Notes
- Shared task/user schemas live in `shared/src/tasks.ts` and `shared/src/tasks/*`.
- Keep frontend/backend contract compatibility when editing shared types.

## Final Checklist Before Finishing
- Relevant tests pass for touched areas.
- Lint/format state is clean for touched files.
- Any required env or behavior changes are documented.
