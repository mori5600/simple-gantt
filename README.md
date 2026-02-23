# simple-gantt (pnpm workspace monorepo)

このリポジトリは `pnpm workspace` を使ったモノレポ構成です。

- `frontend`: frontend (SvelteKit)
- `backend`: backend API (Hono + Prisma + SQLite)
- `shared`: frontend / backend で共有するスキーマと型 (`@simple-gantt/shared`)

## アプリケーション概要

`simple-gantt` は、プロジェクト単位でタスクを管理するシンプルなガントチャートアプリです。
主に小規模チームでの利用を想定し、ローカル環境または LAN 内で運用できます。

<img width="1915" height="613" alt="image" src="https://github.com/user-attachments/assets/b10d881a-ae25-49b0-bc35-e33e90a6b408" />

### 主な機能

- ガント画面でのタスク作成/編集/削除
- タスクの並び替え、日付変更、進捗管理
- 依存タスク (predecessor) の設定
- 担当ユーザーの割り当て
- タスクの絞り込み (検索・担当者・ステータス・期間)
- CSV / Excel (`.xlsx`) へのエクスポート
- プロジェクト管理画面 (`/projects`)
- ユーザー管理画面 (`/users`)

## セットアップ

```sh
pnpm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## Dockerでの運用起動

`compose.yaml` は運用向けに以下の3サービスで構成されています。

- `gateway` (nginx): 外部公開用の入口 (`APP_PORT`, デフォルト `8080`)
- `frontend` (SvelteKit adapter-node)
- `backend` (Hono + Prisma + SQLite)

起動:

```sh
docker compose up -d --build
```

停止:

```sh
docker compose down
```

データ永続化:

- SQLite: `sqlite_data` volume (`/data/simple-gantt.db`)
- backendログ: `backend_logs` volume (`/app/backend/logs`)
- backend 起動時に SQLite は `journal_mode=WAL` が有効化されます。

公開ポート変更:

```sh
APP_PORT=80 docker compose up -d --build
```

## 開発

フロントエンド:

```sh
pnpm frontend:dev
```

バックエンド:

```sh
pnpm backend:dev
```

同時起動:

```sh
pnpm dev
```

## Build / Start / Preview

フロントエンドを個別にビルド/確認する場合:

```sh
pnpm frontend:build
pnpm frontend:build:strict
pnpm frontend:start
pnpm frontend:preview
pnpm frontend:preview:lan
```

- `frontend:build`: `svelte-kit sync` + `vite build`
- `frontend:build:strict`: `lint` + `check` + `build`
- `frontend:start`: `build` 済み成果物を Node.js で起動
- `frontend:preview:lan`: `0.0.0.0:4173` で待ち受け

ワークスペース全体から実行する場合:

```sh
pnpm build
pnpm build:strict
pnpm start
pnpm preview
pnpm preview:lan
```

## Lint / Format

frontend / backend を個別に実行できます。

```sh
pnpm frontend:lint
pnpm frontend:format
pnpm backend:lint
pnpm backend:format
```

全体をまとめて実行する場合:

```sh
pnpm lint
pnpm format
```

## LAN内公開 (単一PCをサーバとして使用)

開発サーバ (`pnpm dev`) ではなく、以下の手順で LAN 内向けに安定運用します。
以下では frontend ポートを `4173` で記載していますが、これはあくまで例です (任意のポートで運用可能)。

1. `backend/.env` を設定する

```env
DATABASE_URL="file:./simple-gantt.db"
SQLITE_BUSY_TIMEOUT_MS=5000
API_PORT=8787
CORS_ORIGIN="http://localhost:5173,http://localhost:<FRONTEND_PORT>,http://<SERVER_IP>:<FRONTEND_PORT>"
LOG_LEVEL=info
```

- `SERVER_IP` はサーバPCの固定IPに置き換えます (例: `192.168.1.10`)。
- `SQLITE_BUSY_TIMEOUT_MS` は DB ロック待ち時間 (ms) です。通常は `5000` を推奨します。
- `4173` は例です。frontend を別ポートで動かす場合は、`CORS_ORIGIN` も同じポートに合わせてください。
- `HOST=0.0.0.0` で frontend を起動する場合、アクセスURLが `http://127.0.0.1:<FRONTEND_PORT>` になることがあるため、必要に応じて `http://127.0.0.1:<FRONTEND_PORT>` も `CORS_ORIGIN` に追加してください。
- `CORS_ORIGIN` はカンマ区切りで複数指定できます。
- `.env` を変更したら backend の再起動が必要です。

2. `frontend/.env` を API 利用にする

```env
VITE_TASKS_DATA_SOURCE=api
VITE_API_BASE_URL="http://<SERVER_IP>:8787"
VITE_SYNC_POLL_INTERVAL_MS=15000
```

3. 初期化 (初回のみ)

```sh
pnpm install
pnpm prisma:generate
pnpm prisma:push
pnpm prisma:seed
```

4. 起動 (本番寄り)

```sh
# terminal 1: backend
pnpm --filter @simple-gantt/backend start

# terminal 2: frontend
pnpm build
HOST=0.0.0.0 PORT=<FRONTEND_PORT> pnpm start

# または preview を使う場合
pnpm preview -- --host 0.0.0.0 --port <FRONTEND_PORT>

# または preview (4173 固定)
pnpm preview:lan
```

5. アクセスURL

- フロントエンド: `http://<SERVER_IP>:<FRONTEND_PORT>`
- API: `http://<SERVER_IP>:8787`

### CORSエラーの確認ポイント

- ブラウザの origin と `CORS_ORIGIN` の値が一致しているか確認してください。
- 例: `http://localhost:<FRONTEND_PORT>` からアクセスするなら、`CORS_ORIGIN` に `http://localhost:<FRONTEND_PORT>` が必要です。

## Prisma

```sh
pnpm prisma:generate
pnpm prisma:push
pnpm prisma:seed
```

Prisma のスキーマはリポジトリ直下の `prisma/schema.prisma` を参照します。

## shared の使い方

`shared/src/tasks.ts` に共通スキーマと型があります。

- `Task`, `User`
- `CreateTaskInput`, `UpdateTaskInput`
- `createTaskSchema`, `updateTaskSchema`, `reorderTasksSchema`

frontend と backend の両方から `@simple-gantt/shared/tasks` を import して利用します。

## 同期間隔の設定

frontend のポーリング間隔は `frontend/.env` の `VITE_*` で調整できます。

- `VITE_SYNC_POLL_INTERVAL_MS`: 全画面共通のポーリング間隔 (ms)
- `VITE_GANTT_SYNC_POLL_INTERVAL_MS`: ガント画面のポーリング間隔 (ms)
- `VITE_ADMIN_SYNC_POLL_INTERVAL_MS`: Projects / Users 画面のポーリング間隔 (ms)

画面別のキーが優先され、未指定時は `VITE_SYNC_POLL_INTERVAL_MS`、さらに未指定時はデフォルト値
(`gantt=15000ms`, `admin=20000ms`) が使われます。
