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




Use this exact flow for every new feature in your current setup (Express backend + Next.js frontend).

Define the contract first.
Decide endpoint(s), request body/query, success shape, and error shape.
Keep all endpoints under /api/v1/... as documented in ARCHITECTURE.md.
Scaffold backend module.
Create src/modules/<feature>/ with:
<feature>.routes.js, <feature>.controller.js, <feature>.service.js, <feature>.model.js, <feature>.validation.js.
Follow existing pattern from user.routes.js and share.routes.js.
Register feature routes centrally.
Mount module in routes/index.js, e.g. router.use("/collections", collectionRoutes).
Wire request pipeline correctly.
Route uses validate(schema) from validate.js.
Route handler uses asyncHandler() from asyncHandler.js.
Controller only maps req/res and calls service.
Service contains business logic.
Model is data shape/persistence adapter.
Standardize responses/errors.
Success via ApiResponse.js.
Failures via ApiError.js.
Let errorHandler.js format final error output.
Add config/env if needed.
Add new env var to .env.example.
Validate it in env.js.
Never hardcode secrets/URLs.
Build frontend route/page for the feature.
In Next App Router, create src/app/<feature>/page.jsx (or nested routes if needed).
Fetch backend using process.env.NEXT_PUBLIC_API_URL, same style as test-connection page.
Implement frontend states against backend contract.
Loading, success, empty, error states.
Submit forms/actions to /api/v1/<feature> endpoints.
Render backend message/data shape directly to reduce mismatch.
Verify end-to-end.
Start backend (npm run dev in backend).
Start frontend (npm run dev in frontend).
Test route manually and through UI.
Confirm expected response and expected failure path.
Lock it in for maintainability.
Add/update module docs in ARCHITECTURE.md if conventions changed.
Add unit/integration tests in backend tests/.
Keep route/controller/service separation strict.