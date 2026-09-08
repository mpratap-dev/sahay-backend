# AGENTS.md

Coding standards for this NestJS + Prisma + PostgreSQL backend. Product thesis, phase order, and source feasibility live in `docs/vision.md`, `docs/architecture.md`, `docs/roadmap.md`, and `.cursor/rules/sahay-project.mdc` — do not duplicate them here.

Prefer the simplest change that solves the problem. Do not add abstractions, layers, or dependencies without a concrete reason in this codebase.

## Before changing code

1. Read the existing implementation and neighboring files in the same feature folder.
2. Reuse existing services, adapters, types, and helpers before adding new ones.
3. Make the smallest coherent change. Do not rewrite unrelated code.

## Layout

Feature code lives under `src/<feature>/` (`auth`, `content`, `ingestion`, `sources`, `health`, `prisma`, `redis`, `config`).

| Concern | Where |
| --- | --- |
| HTTP | `*.controller.ts` — thin; validation via DTOs |
| Business logic | `*.service.ts` in the same feature |
| Swappable I/O | Interface + DI token or registry (see Adapters) |
| Pure transforms | Named exports next to the service (`title-fingerprint.ts`, `topic-mapping.ts`) |
| HTTP contracts | `dto/` with `class-validator` / `class-transformer` |
| Env | Zod in `src/config/env.validation.ts` |
| Database | `prisma/schema.prisma` + `PrismaService` |
| Generated client | `src/generated/prisma` — never edit |

Do not introduce a use-case, repository, or extra module for logic that already belongs in an existing service.

## TypeScript

ESLint uses `strictTypeChecked`. Match it:

- Never `any`, `as any`, or `@ts-ignore`. Prefer `unknown` when the type is genuinely unknown.
- Avoid unnecessary `as` and non-null assertions (`!`). Do not weaken types to silence the compiler.
- Type public API boundaries and domain contracts. Prefer inferred types when the type is obvious.
- Prefer discriminated unions and precise types over loosely typed objects.
- Use `readonly` where mutation is not part of the contract. Do not mark required values optional.

## NestJS

- Controllers handle HTTP only (route, query/body DTO, status). Services own business logic.
- Inject dependencies; do not construct `PrismaClient`, Redis, or HTTP clients by hand in feature code.
- Keep DTOs as request/response contracts. Do not put persistence or ingestion logic in DTOs.
- Register new providers in the feature’s existing module. Do not add a module for a single trivial helper.

## Prisma

- Query through `PrismaService`. Import models and enums from `src/generated/prisma` (or `../generated/prisma/...` from feature code). Do not duplicate schema types by hand.
- Schema changes go in `prisma/schema.prisma` plus a migration. Update `docs/architecture.md` when adding canonical `ContentItem` fields.
- `ContentItem` is the canonical row for feed-facing content. `Article` is the news-specific extension (URL, source, raw snapshot). Do not add parallel news/traffic/government content tables.
- `RawArticle.payload` is an immutable ingest snapshot. After insert, only processing metadata may change.

## Adapters

Adding a source or OTP channel is a new adapter, not a new subsystem.

- Ingestion: implement `SourceFetcher` in `src/ingestion/fetchers/`, register in `FetcherRegistry`.
- OTP: implement `SmsSender` / `EmailSender` and bind the existing DI token.
- Keep fetchers and senders small: I/O in, typed payload out. Normalization and persistence stay in ingestion/auth services.

## Functions and DRY

- One responsibility per function. Name functions with verbs; name values with precise nouns (`rawArticle`, `titleFingerprint` — not `data`, `result`, `item`).
- Extract a function when logic is hard to follow or when the same *business* rule appears twice. Do not extract solely to shorten a file.
- Prefer domain helpers (`titleFingerprint`, `topicSlugsFromRawCategoryLabel`) over generic utilities.
- Early returns over nested conditionals. Clear multi-line code over clever one-liners.
- Comments explain why, never what. Delete dead code.

## Errors and logging

- Do not swallow errors. Catch only to add context, map to a Nest exception, or record processing failure (`RawArticle.processingError`).
- Use Nest HTTP exceptions at the API boundary. Preserve the original error when wrapping.
- Log with the injected Pino `Logger`. Do not use `console.*` in feature code.

## Testing

- Colocate unit tests as `*.spec.ts` next to the file under test. E2E stays in `test/`.
- Cover changed behavior, especially pure helpers and service branches. Prefer behavior over mocking internals.
- Reuse existing test doubles (Prisma mock, sender stubs). Do not hit real SMS/email providers in tests.

## Self-review

- Is this the smallest change? Any unrelated edits?
- Duplicated business logic, or a new abstraction that is not used twice?
- Strict TypeScript: no `any` / stray `as` / `!` / `@ts-ignore`?
- Logic in the right layer (controller vs service vs pure helper vs adapter)?
- Tests updated for the new behavior?
