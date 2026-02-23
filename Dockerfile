# syntax=docker/dockerfile:1.7

FROM node:24-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@10.30.2 --activate

WORKDIR /app

FROM base AS backend-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY backend/package.json backend/package.json
COPY shared/package.json shared/package.json

RUN pnpm install --frozen-lockfile --filter @simple-gantt/backend...

FROM backend-deps AS backend-build

COPY backend backend
COPY shared shared
COPY prisma prisma
COPY scripts scripts

RUN pnpm --filter @simple-gantt/backend build

FROM base AS backend-deps-prod

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY backend/package.json backend/package.json
COPY shared/package.json shared/package.json

RUN pnpm install --prod --frozen-lockfile --filter @simple-gantt/backend...

FROM node:24-slim AS runtime-backend

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@10.30.2 --activate

WORKDIR /app

COPY --from=backend-deps-prod /app/ ./
COPY --from=backend-build /app/backend/dist backend/dist
COPY --from=backend-build /app/shared/dist shared/dist
COPY prisma/schema.prisma prisma/schema.prisma

RUN pnpm --filter @simple-gantt/backend exec prisma generate --schema ../prisma/schema.prisma

RUN mkdir -p /data /app/backend/logs

CMD ["node", "--conditions=production", "backend/dist/index.js"]

FROM base AS frontend-deps

# Build frontend in API mode with same-origin /api requests.
ARG VITE_TASKS_DATA_SOURCE=api
ARG VITE_API_BASE_URL=/
ENV VITE_TASKS_DATA_SOURCE=$VITE_TASKS_DATA_SOURCE
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json

RUN pnpm install --frozen-lockfile --filter @simple-gantt/frontend...

FROM frontend-deps AS frontend-build

COPY frontend frontend
COPY shared shared

RUN pnpm --filter @simple-gantt/frontend build

FROM nginx:1.29-alpine AS runtime-frontend

COPY docker/nginx/frontend-static.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/frontend/build /usr/share/nginx/html
