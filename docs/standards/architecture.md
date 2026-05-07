---
title: Architecture Standard
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# Architecture Standard

## Goal

Keep the application maintainable by separating transport, validation, authorization, business rules, persistence, and presentation.

## Service-Oriented Organization

Code must be organized service-first and module-first. Each business feature owns its service, repository, schemas, and types.

Preferred feature shape:

```text
src/lib/server/modules/<feature>/
  <feature>.schemas.ts
  <feature>.service.ts
  <feature>.repository.ts
  <feature>.types.ts
```

Routes may import service/controller entrypoints, schemas, and shared API helpers. Routes must not import repositories directly.

## Request Flow

```text
SvelteKit route
  -> API handler/controller
  -> Zod validation
  -> ReBAC authorization
  -> Service
  -> Repository
  -> PostgreSQL
```

## SvelteKit Boundary

SvelteKit owns routing, rendering, request context, progressive enhancement, and API transport. Application decisions belong in services, repositories, validation schemas, and authorization modules under `src/lib/server/`.

Do not bypass service/repository boundaries from `+page.server.ts`, `+server.ts`, or `.svelte` files.
