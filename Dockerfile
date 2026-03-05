# syntax=docker/dockerfile:1.7

FROM node:24-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN apt update -y \
	&& apt install -y --no-install-recommends openssl \
	&& rm -rf /var/lib/apt/lists/*

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

FROM backend-deps-prod AS runtime-backend-prep

COPY --from=backend-build /app/backend/dist backend/dist
COPY --from=backend-build /app/shared/dist shared/dist
COPY prisma/schema.prisma prisma/schema.prisma

# COPY with wildcard from another stage may miss hidden ".prisma" internals.
# Use a mounted copy so generated Prisma client files are preserved.
RUN --mount=from=backend-build,source=/app/node_modules/.pnpm,target=/tmp/pnpm,ro \
	set -eu; \
	CLIENT_DIR="$(find /tmp/pnpm -maxdepth 1 -type d -name '@prisma+client@*' | head -n 1)"; \
	CLIENT_BASENAME="$(basename "$CLIENT_DIR")"; \
	rm -rf "/app/node_modules/.pnpm/$CLIENT_BASENAME"; \
	cp -a "$CLIENT_DIR" "/app/node_modules/.pnpm/$CLIENT_BASENAME"; \
	if [ -d /tmp/pnpm/node_modules/.prisma ]; then \
		mkdir -p /app/node_modules/.pnpm/node_modules; \
		rm -rf /app/node_modules/.pnpm/node_modules/.prisma; \
		cp -a /tmp/pnpm/node_modules/.prisma /app/node_modules/.pnpm/node_modules/.prisma; \
	fi

# runtime does not need Prisma CLI package after client generation
RUN rm -rf node_modules/.pnpm/prisma@* \
	&& rm -f node_modules/.pnpm/node_modules/prisma \
	&& rm -f backend/node_modules/prisma \
	&& find node_modules/.pnpm -path '*/node_modules/prisma' -type l -delete \
	&& true

RUN mkdir -p /data /app/backend/logs

FROM node:24-slim AS runtime-backend

ENV NODE_ENV=production
WORKDIR /app

RUN apt update -y \
	&& apt install -y --no-install-recommends openssl \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=runtime-backend-prep /app/ ./

CMD ["node", "--conditions=production", "backend/dist/index.js"]

FROM backend-deps-prod AS runtime-backend-migrate

COPY prisma/schema.prisma prisma/schema.prisma

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
