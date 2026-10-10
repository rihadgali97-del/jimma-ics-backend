# Jimma ICS Backend

Backend API for the Jimma City Islamic Affairs Supreme Council digital platform.
Node.js (ES Modules) + Express + MySQL/Prisma + JWT + Redis + BullMQ.

Status: **Phase 1 — project scaffold**. Only infrastructure exists so far
(auth/RBAC schema, error handling, response envelope, config, Docker). No
feature modules (Nikah, Zakat, Mosques, etc.) yet — see the backend
requirements doc for the full roadmap.

## Folder structure

```
src/
  config/       env, Prisma client, Redis client, Swagger setup
  common/       errors, middlewares (auth, validation, rate limiting, error handler), utils
  database/     Prisma schema, migrations, seed script
  modules/      feature modules (routes/controller/service/validation per feature) — empty in Phase 1
  routes/       top-level API router that mounts each module
  jobs/         BullMQ queues/workers — empty in Phase 1
  docs/         extra OpenAPI fragments if needed
  app.js        Express app assembly
  server.js     process bootstrap (DB/Redis connect, listen, graceful shutdown)
```

## Local setup (without Docker)

1. Copy `.env.example` to `.env` and fill in real values — especially
   `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (generate with
   `openssl rand -hex 64`).
2. Install dependencies:
   ```
   npm install
   ```
3. Run migrations against your MySQL instance:
   ```
   npm run prisma:migrate
   ```
4. Seed roles/permissions/woredas (and optionally a super_admin — set
   `SEED_SUPER_ADMIN_PASSWORD` in `.env` first):
   ```
   npm run seed
   ```
5. Start the dev server (auto-restarts on change):
   ```
   npm run dev
   ```
6. Verify:
   - `GET http://localhost:4000/api/v1/health` → `{ success: true, data: { status: "ok" } }`
   - Swagger UI: `http://localhost:4000/docs`

## With Docker Compose

1. Copy `.env.example` to `.env` and fill in secrets.
2. `docker compose up --build`
3. The `app` service runs `prisma migrate deploy` automatically on start, then boots the API.
4. Seed manually once containers are up: `docker compose exec app npm run seed`

## Testing

```
npm test
```

Runs Jest + Supertest against the Express app directly (no real DB/Redis
needed for Phase 1's health-check tests — see `tests/jest.setup.js`).

Staff & Role Access uses the authenticated `/admin/users`, `/admin/roles`, and
`/admin/audit-logs` endpoints. Staff profiles and role presentation metadata
are stored in the JSON metadata columns added by the staff/role metadata
migration; deployments should apply pending Prisma migrations before using
these endpoints.

The faculty registry uses authenticated `/admin/teachers` CRUD endpoints and
the public `/teachers` directory. Public responses include only published
profiles and omit private phone, email, and honorarium details. Featured
profiles are ordered first; a teacher must be published to be featured.

The Ulema & Fatwa Board uses authenticated `/admin/ulema` CRUD endpoints and
the public `/ulema` directory. Only published scholars are publicly listed;
featured scholars are ordered first. Apply the Ulema profile migration before
using this directory.

### Notifications module

Notification preferences and delivery intents are stored in the
`event_notification_subscriptions` and `notification_logs` tables. Apply the
notifications migration and regenerate Prisma before using the endpoints:

```
npm run prisma:generate
npm run prisma:migrate:deploy
```

Public subscription management uses `POST /api/v1/notifications/subscriptions`
and the `x-notification-manage-token` header returned at creation for reading,
updating, or deleting that browser's preferences. Admins with event or
announcement write permission can inspect the outbox at
`GET /api/v1/admin/notifications` and retry failed records at
`POST /api/v1/admin/notifications/:id/retry` after correcting provider
configuration.

Published events and announcements are queued to the configured Telegram
channel. Event registration requires a valid email address; confirmation
emails are queued when a free registration is confirmed and after a paid
registration's payment is approved.
Event reminders and urgent announcements are delivered by email only after
the subscriber verifies their address. The BullMQ worker scans the database
outbox for due records every 15 seconds, retries provider failures, and marks
final delivery status in the outbox.

Configure email delivery in one of two supported ways:

- Gmail API over HTTPS (recommended when SMTP is blocked): enable the Gmail API
  in the Google Cloud project, create OAuth credentials, and set
  `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, and
  `GMAIL_OAUTH2_USER` in the backend `.env`. The refresh token must include the
  `https://www.googleapis.com/auth/gmail.send` scope. This sends through the
  Gmail API and does not use SMTP port 587.
- Gmail SMTP app-password flow: set `GMAIL_SMTP_USER` and
  `GMAIL_APP_PASSWORD`. This uses outbound TCP 587 to `smtp.gmail.com`.

When any Gmail OAuth setting is present, delivery uses the Gmail API and reports
incomplete OAuth configuration explicitly rather than falling back to SMTP.
`EMAIL_FROM_ADDRESS` is optional and defaults to the authenticated Gmail
address; a custom From address must be configured as a Gmail send-as alias.
Store secrets only in the backend `.env` (never in frontend config, source,
logs, or chat).

Subscribers receive a time-limited verification link before subscription email
is used. For remote browser push, configure `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`; generate a key pair with
`npx web-push generate-vapid-keys`. For Telegram, configure
`TELEGRAM_BOT_TOKEN` and (if needed) `TELEGRAM_CHANNEL_ID`; the default target
is `@riho_information` (`t.me/riho_information`). The bot must be added to that
channel with permission to post. SMS is intentionally disabled until gateway
credentials are available. Provider failures are reported as failed outbox
records; they are never reported as successful sends.

Admins with event or announcement write permission can send public Telegram
broadcasts from the **Admin → SMS and Telegram Gateway** composer. The
authenticated endpoints are `GET /api/v1/admin/notifications/telegram/status`
and `POST /api/v1/admin/notifications/telegram`; broadcasts are rate limited
and delivered only to `TELEGRAM_CHANNEL_ID`. The bot token is never returned
to the frontend. `GET /api/v1/admin/notifications/telegram/history` returns
the paginated, persisted send history. Apply the
`20261004223000_add_notification_sending_status` migration before deploying
the gateway history changes. SMS and guardian-specific Sabaq messages remain
disabled.

To verify email delivery, run `npm run test:email -- recipient@example.com`.
This sends one real test message. With Gmail OAuth configured, it uses the
Gmail API over HTTPS; otherwise it uses Gmail SMTP and requires outbound TCP
587 to `smtp.gmail.com`.

The Council Document Archive is admin-only and stores files as authenticated
Cloudinary assets. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
`CLOUDINARY_API_SECRET` in the backend `.env` file; never put these values in
the frontend environment. Set `CLOUDINARY_COUNCIL_DOCUMENTS_FOLDER` to the
desired Cloudinary folder. Apply pending migrations and regenerate the Prisma
client before starting the backend:

```
npm run prisma:generate
npm run prisma:migrate:deploy
```

Documents can be any file format and are limited by `MAX_UPLOAD_SIZE_MB`
(10 MB by default); downloads are streamed through the authenticated API
rather than exposing Cloudinary URLs. Admins can create seven-day sharing
links for Telegram, WhatsApp, email, or copy/paste. Anyone with a share link
can download the file until it expires, so only share documents intended for
the recipient.

Mosque and madrasa photos are uploaded to Cloudinary as public image assets.
The database stores only the Cloudinary URL and public ID on each directory
record, not the image file or a document row. Set
`CLOUDINARY_DIRECTORY_IMAGES_FOLDER` to change their folder (defaults to
`council-directory`). Apply the
`20261005100000_add_directory_cloudinary_photos` migration and regenerate the
Prisma client before deploying the directory photo endpoints.

Madrasa administration also stores an optional head-teacher assignment
(selected from teachers already assigned to that madrasa) and an optional
Huffaz graduate count. Apply the
`20261005103000_add_madrasa_head_teacher_and_hifz_count` migration and
regenerate the Prisma client before deploying those fields.

Admin mosque registration and editing can link one registered madrasa to a
mosque. The madrasa can be linked to only one mosque at a time. Apply the
`20261005110000_link_madrasas_to_mosques` migration and regenerate the Prisma
client before deploying this relationship.

The admin System Settings page shows database reachability and whether
notification and storage integrations have their required configuration.
Its read-only status endpoint is restricted to `super_admin`; secret values
are never returned to the frontend. Set provider credentials in the backend
environment and restart the backend to update their status.

## Conventions

- Every feature module lives under `src/modules/<name>/` with its own
  `*.routes.js`, `*.controller.js`, `*.service.js`, `*.validation.js`, and
  `*.repository.js` (when it needs non-trivial queries beyond simple Prisma calls).
- Controllers stay thin: parse request → call service → `sendSuccess`/`sendCreated`.
- Business logic lives in services. Services throw `AppError` subclasses
  (`src/common/errors/httpErrors.js`) — never format HTTP responses directly.
- Every request body/query/params is validated with a Zod schema via the
  `validate()` middleware before it reaches a controller.
- Protected routes: `authenticate` (verifies JWT, loads user+role+permissions)
  then `authorize('some.permission')` or `requireRole('some_role')`.
- All API responses use the envelope in `src/common/utils/apiResponse.js`.