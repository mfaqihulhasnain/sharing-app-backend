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



