---
name: sahay-project
description: >
  Reference SAHAY's product vision, architecture, and roadmap docs before planning
  implementation work, proposing schema/architecture changes, adding a data source,
  or scoping a phase for the SAHAY civic-tech platform. Trigger for any request
  involving "implement phase N", "add a data source/integration", "ContentItem
  schema", "ranking/relevance engine", "area alerts", "civic issue reporting",
  or any change to the NestJS backend or Next.js frontend's data model.
---

# SAHAY Project Context

Before planning or writing any implementation for this project, read:

- `docs/vision.md` — product goals, target users, success metrics. Consult this
  when a feature request is ambiguous and you need to know *why* something
  matters, not just what to build.
- `docs/architecture.md` — canonical `ContentItem` model, source trust model,
  event intelligence design, module boundaries (Area Alerts, My Constituency,
  My Issues, Feed Composition, etc.). Consult this before touching the Prisma
  schema, adding a new source adapter, or changing how data flows between
  ingestion → normalization → event intelligence → feed.
- `docs/roadmap.md` — phase order, dependencies, and per-source **feasibility
  status** (✅ / ⚠️ / ❌). Consult this before starting work on any phase.

## Rules to follow

1. **Check feasibility status before implementing a data source.** `roadmap.md`
   marks each source ✅ feasible, ⚠️ feasible but scoped down, or ❌ not viable
   as originally described. If a source is ⚠️ or ❌, implement the *narrowed*
   scope described there (e.g. traffic = bounded corridor list via a paid API,
   not a city-wide feed; social signals = citizen-submitted reports, not
   Reddit/Facebook scraping) — do not implement against the original wishlist
   description without flagging the discrepancy.

2. **Respect phase order and dependencies.** Don't scaffold Phase 7 (Event
   Intelligence) work before Phase 2 (Canonical Data Model) exists, etc. If a
   request skips ahead of the roadmap's dependency graph, point that out before
   proceeding rather than silently building out of order.

3. **New `ContentItem` fields go through architecture.md first.** The schema
   is intentionally canonical across all sources (news, government, traffic,
   citizen reports). Before adding a field to the Prisma model, check whether
   `architecture.md`'s "Canonical content concept" section already covers it,
   and if not, treat that doc as needing an update alongside the migration —
   don't let the schema and the doc drift apart.

4. **Distinguish "display/track" from "submit" for civic actions.** Per
   `architecture.md`'s My Issues section, tracking an issue is straightforward;
   submitting it to an external authority mostly has no public API. Don't build
   UI or backend logic that promises automatic filing to a government portal
   without checking whether that specific portal has been validated.

5. **If an implementation decision isn't covered by the docs, say so.** Propose
   the addition explicitly (e.g. "this isn't in roadmap.md — suggest adding it
   under Phase X") rather than making an undocumented architectural choice.

6. **Language field is first-class from Phase 1B onward.** Any new `ContentItem`-
   producing code path (ingestion adapter, citizen report, etc.) must populate
   `language` / `language_confidence` — this was a deliberate schema decision,
   not an optional add-on.