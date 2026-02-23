# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY backend backend
COPY frontend frontend
COPY prisma prisma
COPY shared shared

# Build frontend in API mode with same-origin /api requests.
ARG VITE_TASKS_DATA_SOURCE=api
ARG VITE_API_BASE_URL=
ENV VITE_TASKS_DATA_SOURCE=$VITE_TASKS_DATA_SOURCE
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN pnpm --filter @simple-gantt/backend prisma:generate
RUN pnpm --filter @simple-gantt/frontend build

FROM node:22-bookworm-slim AS runtime

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY --from=build /app /app

RUN mkdir -p /data /app/backend/logs

CMD ["node", "frontend/build"]
