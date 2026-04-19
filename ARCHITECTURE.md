# Architecture Guide

## Folder Structure Overview
- `src/`: application source for configuration, middleware, routes, modules, and shared utilities.
- `src/config/`: startup configuration, environment validation, and database bootstrap placeholders.
- `src/routes/`: central API version registry and shared route mounting.
- `src/modules/`: feature-oriented slices containing routes, controllers, services, models, and validation.
- `src/middleware/`: cross-cutting Express middleware such as auth, validation, rate limiting, and errors.
- `src/utils/`: shared helpers for API responses, API errors, and async controller wrapping.
- `tests/`: reserved space for unit and integration test suites.

## How to Add a New Feature/Module
1. Create `src/modules/<feature>/`.
2. Add `<feature>.routes.js` to define endpoints only.
3. Add `<feature>.controller.js` to translate req/res into service calls.
4. Add `<feature>.service.js` to hold business logic.
5. Add `<feature>.model.js` for the data shape or persistence adapter.
6. Add `<feature>.validation.js` for zod schemas.
7. Register the module in `src/routes/index.js` under `/api/v1/`.

## The Golden Rules
- Routes only define endpoints, never logic.
- Controllers only handle req/res, call service for logic.
- Services contain all business logic, never touch req/res.
- Models only define schema/shape of data.
- All async controllers must use `asyncHandler()`.
- All responses use `ApiResponse`, all errors use `ApiError`.
- All inputs validated before reaching controller.
- Never hardcode values, always use `config/env.js`.

## API Versioning Rule
- All routes live under `/api/v1/`.
- When breaking changes are needed, add `/api/v2/` and keep `v1` intact.

## Environment Variables Guide
- Always add new variables to `.env.example` immediately.
- Never commit `.env`.
- Validate environment variables in `src/config/env.js` during startup.

## Dev vs Prod Checklist
- Dev: use `nodemon`, `morgan` in `dev`, and keep stack traces enabled.
- Prod: use PM2 or Docker, `morgan` in `combined`, stack traces off, rate limiting on, and `helmet` on.

## Adding a New npm Package Rule
- Always check whether the utility already exists in `src/utils/`.
- Document why the package was added in a nearby code comment.

## Current Implementation Status (April 2026)
- Database infrastructure is now implemented with Supabase PostgreSQL + Prisma.
- Infra database lifecycle is active in:
  - `src/lib/prisma.js`
  - `src/config/db.js`
  - `server.js` (connect before listen, graceful disconnect on shutdown)
- Prisma assets are present in:
  - `prisma/schema.prisma`
  - `prisma/seed.js`
- Prisma migrations are not tracked in the current schema-first workflow.
- API module business logic under `src/modules/**` is still scaffolded and intentionally separate from this infra setup.

## Supabase + Prisma Connection Strategy (Current)
- `DATABASE_URL` is used for app/runtime connectivity.
- `DIRECT_URL` is used for Prisma schema/admin operations.
- Recommended practical setup in this project:
  - `DATABASE_URL`: Supabase transaction pooler (`pooler` host, port `6543`)
  - `DIRECT_URL`: Supabase session/direct path (`pooler` host port `5432`, or `db.<project-ref>.supabase.co:5432` when reachable)

## Database Workflow (Current Team Choice: Schema-First)
- This backend currently follows schema-first DB sync (not migration-first governance).
- Standard flow:
1. Update `prisma/schema.prisma`.
2. Run `npx prisma generate`.
3. Run `npx prisma db push`.
4. Run `npx prisma db seed` (optional baseline data).
- `prisma migrate dev/deploy` is not part of the default workflow right now.
- If migration-first is adopted later, formalize it here before using migrations in team flow.

## Current Prisma Data Model
- `User`
  - identity/profile fields plus auth hash (`passwordHash`)
- `Share`
  - post container with `senderId`, optional `text`, and timestamps
- `ShareRecipient`
  - join table controlling private audience visibility
- `ShareFile`
  - file metadata linked to shares (`name`, `mimeType`, `sizeBytes`, `storagePath`)
- Relation behaviors currently enforced by schema:
  - `Share` delete cascades to `ShareRecipient` and `ShareFile`
  - `Share.senderId -> User.id` uses restrict-on-delete

## Backend Database Scripts
- `npm run prisma:generate` -> generate Prisma client
- `npm run prisma:seed` -> seed baseline users/data
- `npm run prisma:studio` -> open Prisma Studio

## Environment Variables Used for DB
- `DATABASE_URL`
- `DIRECT_URL`
- Keep both documented in `.env.example` and validated in `src/config/env.js`.
- Keep credentials URL-safe (example: encode `@` as `%40` in passwords).


