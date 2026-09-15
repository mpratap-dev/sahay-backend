# SAHAY Backend

**Smart Access & Holistic Assistance for You** — civic intelligence platform API for Indian citizens (launch geography: Delhi).

This NestJS service ingests multi-source signals (news RSS, government, alerts), normalizes them into a canonical content model, and exposes APIs for feed, auth, and personalization.

Product context: [`docs/vision.md`](docs/vision.md) · Architecture: [`docs/architecture.md`](docs/architecture.md) · Roadmap: [`docs/roadmap.md`](docs/roadmap.md)

---

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **pnpm** — install via [pnpm.io](https://pnpm.io/installation)
- **Docker** — for local PostgreSQL and Redis (`docker compose`)

---

## First-time setup

1. **Clone and install dependencies**

   ```bash
   git clone <repo-url>
   cd sahay-backend
   pnpm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   - Defaults in `.env.example` work for local development (Postgres, Redis, OTP to console).
   - **`GOOGLE_CLIENT_IDS` is required** — add at least one Google OAuth client ID (comma-separated if multiple). Without it the app will fail env validation at startup.
   - Optionally set `CORS_ORIGINS` (e.g. `3000,59012`) so the API accepts requests from your frontend dev server.

3. **Start PostgreSQL and Redis**

   ```bash
   docker compose up -d
   ```

4. **Apply database migrations and generate Prisma client**

   ```bash
   pnpm exec prisma migrate deploy
   pnpm exec prisma generate
   ```

5. **Seed sources, topics, and interest areas**

   ```bash
   pnpm seed
   ```

6. **Run the API in watch mode**

   ```bash
   pnpm dev
   ```

   The server listens on **`http://localhost:3001`** by default (`PORT` in `.env`).

---

## API documentation (Swagger)

With the dev server running, open:

**http://localhost:3001/docs**

Swagger UI lists all HTTP endpoints (auth, content feed, personalization, ingestion, health). Use **Authorize** with a Bearer token for protected routes after signing in via the auth flow.

---

## Common commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start API with hot reload |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start:prod` | Run compiled production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests |
| `pnpm test:e2e` | End-to-end tests |
| `pnpm prisma` | Open Prisma Studio (DB browser) |
| `pnpm seed` | Re-run database seed |

---

## Tech stack

| Technology | Role |
| --- | --- |
| **NestJS** | HTTP API framework, modules, DI, scheduling |
| **TypeScript** | Application language |
| **Prisma** | ORM, schema, migrations (`PostgreSQL`) |
| **PostgreSQL** | Primary data store (content, users, sources) |
| **Redis** | Job queue backing store for BullMQ |
| **BullMQ** | Background ingestion jobs (fetch, normalize) |
| **Zod** | Environment variable validation |
| **class-validator / class-transformer** | Request DTO validation |
| **@nestjs/swagger** | OpenAPI spec and Swagger UI at `/docs` |
| **nestjs-pino** | Structured HTTP logging |
| **JWT (jose / @nestjs/jwt)** | Access and refresh tokens |
| **feedsmith** | RSS/Atom feed parsing for ingestion |

---

## Suggested additions to this documentation

Consider adding these over time (not all are needed on day one):

- **Environment variable reference** — table describing every `.env` key, defaults, and when it is required (e.g. MSG91, Resend in production).
- **Auth flow guide** — how OTP login, refresh tokens, and Google/Apple ID token sign-in work for frontend and API testers.
- **Ingestion operations** — how to trigger or monitor RSS fetches, read queue/worker logs, and add a new source (pointer to `AGENTS.md` adapter pattern).
- **Troubleshooting** — Docker port conflicts, migration failures, Redis connection errors, missing `GOOGLE_CLIENT_IDS`.
- **Contributing** — branch naming, `pnpm lint` / `pnpm build` before PR, link to `AGENTS.md` coding standards.
- **Deployment** — production checklist (secrets, `prisma migrate deploy`, process manager, health endpoint).
- **Related repos** — link to the SAHAY frontend/mobile clients when they exist.

---

## License

Private / UNLICENSED (see `package.json`).
