---
title: Repository Agent Instructions
status: active
owner: engineering
last_reviewed: 2026-05-07
---

# AGENTS.md

## Mandatory Conventions

Agents MUST follow the conventions in this file before making or planning code changes. These conventions capture the agreed project decisions from the barcode application planning discussion and take precedence over ad-hoc implementation preferences unless the user explicitly changes them.

When a task touches architecture, routes, authorization, validation, barcode allocation, printing, logging, tests, plans, or documentation, agents MUST check the relevant section below and preserve the agreed approach.

## Project

This repository contains the Vision Centre Barcode Management System, a SvelteKit-based application for generating, printing, reserving, reprinting, and auditing unique OPD card barcodes for outreach and vision centre workflows.

## Required Architecture

- Organize code service-first and module-first.
- Use clean architecture boundaries.
- Keep SvelteKit routes thin; routes must only handle transport concerns, request parsing, response shaping, and delegation.
- Prefer reusable shared Svelte components for repeated UI workflows, panels, forms, confirmations, print previews, and validation hints.
- Do not duplicate substantial Svelte markup across pages or sections when a shared component can express the workflow clearly.
- Put business logic in services.
- Put database access in repositories.
- Put validation in shared Zod schemas.
- Put authorization checks behind the central ReBAC authorization layer.
- Do not place business rules in Svelte components, route handlers, or repositories.

Preferred flow:

```text
Route -> API handler/controller -> Zod schema -> AuthZ -> Service -> Repository -> Database
```

Service-oriented module shape:

```text
src/lib/server/modules/<feature>/
  <feature>.schemas.ts
  <feature>.service.ts
  <feature>.repository.ts
  <feature>.types.ts
```

Routes may import service/controller entrypoints, schemas, and shared API helpers. Routes must not import repositories directly.

## Required Development Workflow

- For planned functionality, prefer focused Spark subagents for bounded code-writing tasks where practical.
- Use a dedicated Spark subagent for security audit of every new or changed route before commit.
- Use a dedicated documentation subagent for new or changed routes, workflows, and privilege-sensitive features.
- Documentation subagents must update indexes, YAML frontmatter metadata, and check stale docs after code changes.
- Subagent outputs must be reviewed by the coordinating agent before work is considered complete.

## Core Stack Decisions

- SvelteKit with TypeScript.
- PostgreSQL as the authoritative database.
- Drizzle ORM for database access and migrations.
- Zod for validation.
- Better Auth for authentication/session handling.
- Local PostgreSQL-backed ReBAC authorization with OpenFGA-style relationship semantics.
- `smol-toml` for the central privilege registry.
- Vitest for unit, service, repository, and route tests.
- `@testing-library/svelte` for Svelte component tests.
- Playwright for critical end-to-end smoke tests.
- PostgreSQL test database for repository/service integration tests.
- V8 coverage through Vitest for coverage reporting.
- Structured runtime logging, SQL error logging, and audit logging from the beginning.

## SvelteKit Conventions

- Use the project-local Svelte MCP server for Svelte/SvelteKit work when available.
- For Svelte/SvelteKit tasks, call `list-sections` first, then fetch all relevant docs with `get-documentation` before implementation.
- After writing or changing Svelte code, run `svelte-autofixer` and iterate until issues and suggestions are resolved.
- If Svelte MCP tools are unavailable, state that clearly and fall back to official Svelte/SvelteKit documentation.
- Follow SvelteKit file-based routing and keep route files focused on route responsibilities.
- Put server-only code under `src/lib/server/`; never import server-only modules into client-executed Svelte components.
- Use route groups such as `(auth)` and `(app)` to organize layouts without changing public URLs.
- Use `+layout.server.ts` for authenticated app-shell data and access checks that apply to an entire route group.
- Use `+page.server.ts` for page-specific server data loading.
- Use `+server.ts` for JSON/API endpoints only; keep these handlers thin and delegate to shared API handlers/services.
- Use SvelteKit form actions only for simple progressive-enhancement UI forms; API-first workflows should call `/api/v1/**` endpoints.
- Do not query the database from `.svelte` files.
- Do not put secrets, database clients, auth internals, or repositories in client-loadable modules.
- Use typed route `$types` where applicable.
- Use `hooks.server.ts` for request context, request IDs, session loading, centralized safe error handling, and security headers.
- Prefer server-side validation and authorization as authoritative even when client-side validation exists.

## Barcode Requirements

- Barcode format is `PP-YY-SSSSSS`.
- `PP` is the PEC code left-padded to 2 digits.
- `YY` is the manually selected 2-digit barcode year.
- `SSSSSS` is the serial number left-padded to 6 digits.
- Example: PEC code `4`, year `26`, serial `1` prints as `04-26-000001`.
- Barcode output must include both machine-readable barcode and human-readable text.
- Browser/PDF, ZPL, and EPL print outputs must all use the exact same barcode value.
- Barcode series reset is a manual privileged operation, not an automatic calendar-year operation.

## Authorization Requirements

- Treat `authz/privileges.toml` as the central authoritative privilege registry.
- Every API mutation must authorize against a named privilege.
- `barcode_print_manager` can only operate on allocated PECs.
- Privilege-sensitive changes must be audit-logged with user, action, resource, request ID, timestamp, reason, and before/after data where applicable.

## Rate Limiting And Route Security

- Every API route must have an explicit rate-limit policy.
- Mutation routes must use stricter rate limits than read-only routes.
- Authentication, barcode allocation, sequence reset, offline reservation, reprint, and user-management routes require especially conservative limits.
- Rate-limit failures must return a stable `429` response with request ID and safe retry guidance.
- Route changes are not complete until the dedicated Spark security-audit subagent confirms validation, authorization, rate limiting, audit logging, and safe error handling.

## TDD Requirement

- Use test-driven development for all business logic.
- Before implementing or changing service behavior, add or update failing tests that describe the expected behavior.
- Keep barcode allocation, sequence reset, range reservation, reprint, validation, and authorization behavior covered by tests.
- Bug fixes must include a regression test unless no practical test seam exists.
- Do not weaken or delete tests to make implementation pass unless the test is demonstrably wrong and the correction is documented in the change.
- Prefer fast unit tests for pure logic and service tests with transactional database setup for allocation/concurrency rules.
- Use Vitest for unit, service, repository, and route-level tests.
- Use `@testing-library/svelte` for component behavior tests.
- Use Playwright only for critical end-to-end user journeys and smoke tests.
- Use a real PostgreSQL test database for database behavior, transactions, locking, and concurrency tests.
- Track coverage with Vitest V8 coverage and prioritize meaningful branch coverage for business rules over superficial UI coverage.

## Documentation Requirements

- Keep implementation plans in dated, folder-wise directories under `.plans/`.
- Each plan folder must include a plan document and an implementation-status document.
- Organize documentation by domain/blueprint under `docs/domains/`.
- Each domain blueprint folder must include an `index.md` and may include `technical.md`, `user-guide.md`, `api.md`, `testing.md`, and `security.md` as relevant.
- Keep cross-cutting engineering standards in `docs/standards/`.
- Keep user-facing cross-domain indexes in `docs/user/`.
- Update docs when changing architecture, workflows, authorization, database shape, or printing behavior.
- All Markdown files must include YAML frontmatter metadata.
- Index documents must be updated whenever files are added, renamed, deprecated, or materially changed.

## Quality Rules

- Use transactions and row-level locking for barcode allocation.
- Never generate duplicate barcode values.
- Never expose raw SQL errors to users.
- Keep API errors stable and user-safe.
- Do not commit secrets, `.env` files, local database dumps, or generated build artifacts.
- Do not create git commits unless the user explicitly asks.
