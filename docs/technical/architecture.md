---
title: Architecture
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# Architecture

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

## Route Rules

- Routes must stay thin.
- Routes must not contain barcode allocation logic.
- Routes must not issue direct database queries except through approved framework/auth integration where unavoidable.
- Routes must return stable API responses and delegate all business decisions.
- Routes must use shared request handling that applies request ID, Zod validation, authentication, authorization, rate limiting, structured logging, and safe error mapping.
- New or changed routes must be reviewed by a dedicated Spark security-audit subagent before commit.
- New or changed routes must be documented by a dedicated documentation subagent before commit.

## Service Rules

- Services own business logic.
- Services coordinate transactions.
- Services enforce barcode lifecycle rules.
- Services call authorization only through centralized helpers.
- Services write audit events for sensitive operations.

## Repository Rules

- Repositories own database access.
- Repositories do not decide privileges.
- Repositories do not contain UI or transport logic.
- Repositories may contain Drizzle queries and isolated raw SQL where PostgreSQL-specific locking or conflict checks are required.

## Subagent Delivery Rules

- Planned functionality should be implemented by focused Spark code-writing subagents where practical.
- Each implementation subagent must own a bounded area and follow TDD.
- A separate Spark security-audit subagent must audit route security before commit.
- A separate documentation subagent must update route, workflow, and privilege documentation before commit.
