# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two independent npm projects (no root package.json / workspace):

- `backend/` — Express 5 + Sequelize 6 (PostgreSQL on Neon) API, CommonJS, plain JavaScript.
- `frontend/` — the **retired** Next.js frontend. The live frontend is the sibling repo `../Tutelage-Frontend` (see its CLAUDE.md); API changes usually need edits there too.
- `docs/brand/brand-theme.md` — brand colors/tokens (primary `#f59e0b`, accent `#fec016`); follow it for UI work.

## Commands

Backend (`cd backend`):
- `npm run dev` — nodemon on `PORT` (default 3001). Reads `backend/.env` (see `.env.example`).
- Tests use Node's built-in runner (`node:test`); shared doubles in `tests/helpers.js`:
  - `npm test` — `tests/unit`, no DB, <1s.
  - `npm run test:api` — `tests/api`: boots the app on a random port via `startApp()` and calls it with fetch. **Read-only** against the configured DB (GETs and requests that must be rejected) — keep it that way.
  - `npm run test:db` — `tests/db`: creates/deletes rows; skipped unless `TEST_DATABASE_URL` is set. Never point it at the real DB.
  - `npm run test:all` — all three. `app.js` exports the app and only listens when run directly, so tests can import it.
- `npm run bench:search` — search benchmark.
- Migrations/one-offs: `node scripts/<name>.js` (e.g. `migrate_*.js`, `seed.js`, `resetAndSeed.js` — the latter is destructive).

## Backend architecture

- `app.js` mounts every router under `/api/<resource>` (kebab-case paths, e.g. `/api/esl-videos`, `/api/admin/quiz`). Adding a resource = model + controller + route file + `app.use` line in `app.js`.
- `models/index.js` auto-loads every file in `models/` and calls `associate()`. Import models via `require('../models')`.
- **Schema changes are not automatic**: `sequelize.sync({ alter: false })` only creates missing tables. Altering existing tables requires a script in `scripts/` (pattern: `queryInterface.describeTable` then `addColumn` if missing).
- DB connection: `DATABASE_URL` (Neon pooled URL) if set, else the discrete `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`. If neither is set or `SKIP_DB=true`, the server starts without a DB.
- Sessions use the default in-memory store (lost on restart).

### Auth & roles
- `middlewares/auth.js` `isAuthenticated`: session `userId` first, then JWT from `Authorization: Bearer`, `token` cookie, or `X-Access-Token`; on expiry it auto-refreshes from `refreshToken` cookie / `X-Refresh-Token`. Inactive users (`isActive=false`) get 403.
- Roles: `ADMIN`, `MAIN_MANAGER`, plus regular users. `isAdmin` (auth.js) allows ADMIN **and** MAIN_MANAGER; `middlewares/adminAuth.js` allows **ADMIN only**. Pick deliberately.
- **Approval workflow**: content controllers (blogs, videos, audios, readings, writings, speakings, stories, ESL audios/videos, landing sections) check `req.user.role`: ADMIN writes apply immediately; MAIN_MANAGER create/update/delete is stored as an `ApprovalRequest` and an email is sent (`config/email.js`). `controllers/approvalController.js` applies approved requests — when adding a new content type or field, update its `getModelByType` / `joinTypeMap` too.

### Tags, PDFs, search
- Tags are polymorphic via `ResourceTag (resourceType, resourceId, tagId)`. Namespaces are lowercase and not 1:1 with models (Blog → `reading`, EslVideo → `video`, EslAudio → `audio`; see `joinTypeMap` in approvalController).
- Task PDFs live in the `TaskPdf` table (`resourceType`, `resourceId`), not columns on the resource.
- `middlewares/pdfUpload.js`: multer memory storage, PDF only, 25MB; fields `pdfFile` (1) and `taskPdfs` (up to 10). Files are uploaded to the external RestPDF service (`utils/restPdfClient.js`, `REST_PDF_*` env) and the resulting URLs are injected into `req.body` before the controller runs. (`frontend/README.md` still says `taskPdfFile`; the middleware is authoritative.)
- `/api/search` is a single endpoint across tests, courses, blogs, skills, ESL resources — see `backend/docs/search.md`. Tokenizing/where-building lives in `utils/searchUtils.js`.
- Cookie/CORS deployment notes behind a proxy: `backend/docs/production-cookies.md`. CORS allows the comma-separated origins in `FRONTEND_URL`, plus any `http://localhost:<port>` when `NODE_ENV` is not `production`.
- Paginated list handlers must sort with an `id` tie-breaker (`order: [[sortBy, dir], ['id', dir]]`); sorting by `createdAt` alone makes pages overlap and skip rows. Stories and ESL audios/videos take `?page=` on their list route; ESL returns `{ data: [], pagination }` instead of `{ data: { <key>: [], pagination } }`.

