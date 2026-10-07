# SkillHub Server

Standalone Node.js 22 + Express 4 + TypeScript API for SkillHub. This repository contains no React/Vite frontend. Shared domain records are copied into `shared/` so the server builds without the Client repository.

## Requirements and local setup

- Node.js 22+
- pnpm 11.25+

```bash
cp .env.example .env
pnpm install
pnpm dev
```

The API listens on `http://localhost:4000`; health is `GET /api/health`. Use `ALLOWED_ORIGINS` as a comma-separated exact origin allowlist for your separately hosted client. For example, local Vite is `http://localhost:5173`. In production set this to the frontend's HTTPS origin. CORS is a browser boundary, not an authorization mechanism; all protected routes continue to verify Firebase bearer tokens and server-side roles.

Without a MongoDB URI, the API serves seeded, in-memory demo data which resets at restart. For persistent production operation set `MONGODB_URI`, `DEMO_MODE=false`, and the Firebase Admin service-account JSON in the protected runtime environment. `ADMIN_EMAILS` is a comma-separated list of verified Firebase email addresses allowed to receive the admin role. Never commit `.env` or share private values in chat.

## Build and test

```bash
pnpm typecheck
pnpm build
pnpm test
pnpm start
```

The root `Dockerfile` builds and runs the API only, uses the pinned pnpm toolchain/lockfile, listens on `PORT` (default `4000`), and exposes unauthenticated readiness at `GET /api/health`.

## Source layout

- `src/server.ts` — Express API-only listener, CORS and shared security headers.
- `src/routes/` — REST API surface for courses, users, enrollment, progress, reviews and dashboards.
- `src/middleware/` — Firebase/demo token validation and role checks.
- `src/models/`, `src/config/`, `src/services/` — MongoDB, Firebase Admin and demo persistence adapters.
- `shared/` — server-visible domain types and seed records; keep API contracts aligned with the Client's copy.

## API groups

`/api/health`, `/api/courses`, `/api/categories`, `/api/instructors`, `/api/auth`, `/api/profile`, `/api/enrollments`, `/api/reviews`, `/api/wishlist`, `/api/notifications`, `/api/certificates`, `/api/dashboard`, and protected `/api/admin/*` routes. See `src/routes/api.ts` for concrete methods and authorization rules.
