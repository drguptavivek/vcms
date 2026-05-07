---
title: SvelteKit Best Practices
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# SvelteKit Best Practices

## Goals

Use SvelteKit as the transport, rendering, routing, and progressive-enhancement layer while keeping business logic in services.

## Project-Local Svelte MCP

This repository includes a project-local Codex MCP configuration at:

```text
.codex/config.toml
```

The Svelte MCP server must be used for Svelte/SvelteKit work when available.

Required workflow:

- call `list-sections` first for Svelte/SvelteKit tasks
- fetch all relevant docs with `get-documentation`
- run `svelte-autofixer` after writing or changing Svelte code
- iterate until Svelte MCP issues and suggestions are resolved
- if MCP tools are unavailable, state that clearly and fall back to official Svelte/SvelteKit documentation

## Project Structure

Use the standard SvelteKit structure:

```text
src/
  lib/
    server/
  routes/
  hooks.server.ts
  app.html
  error.html
static/
tests/
```

Server-only modules must live under `src/lib/server/`. Client-rendered Svelte components must not import server-only modules.

## Route Organization

Use route groups to organize layouts without changing public URLs:

```text
src/routes/
  (auth)/
    login/
  (app)/
    dashboard/
    barcode/
    pecs/
    users/
  api/
    v1/
```

## Route File Responsibilities

- `+layout.server.ts`: route-group session loading, app-shell data, and broad access checks.
- `+layout.svelte`: layout rendering only.
- `+page.server.ts`: page-specific data loading and simple form-action delegation.
- `+page.svelte`: UI rendering and user interaction only.
- `+server.ts`: JSON/API endpoint transport only.

Routes must delegate validation, authorization, business logic, and persistence to shared server modules.

## API Routes

API routes must be thin:

```text
+server.ts -> shared API handler -> Zod schema -> AuthZ -> Service -> Repository
```

Every API route must have:

- request ID context
- Zod validation
- authentication policy
- authorization policy where applicable
- rate-limit policy
- safe error mapping
- structured logging
- audit logging for sensitive mutations

## Data Loading

- Use `+layout.server.ts` for data required across an authenticated app area.
- Use `+page.server.ts` for page-specific data.
- Keep `load` functions small; they should call services or query-facing read services, not embed business logic.
- Do not query PostgreSQL from `.svelte` components.
- Do not expose server-only secrets or raw DB records to client data.

## Forms

Use SvelteKit form actions for simple progressive-enhancement flows where the page is the primary interface.

Use `/api/v1/**` endpoints for API-first workflows, especially:

- barcode allocation
- reprint
- manual sequence reset
- offline range reservation
- user/role/PEC allocation changes
- printer template management

Client-side validation is for usability only. Server-side Zod validation is authoritative.

## Hooks

Use `hooks.server.ts` for cross-cutting server concerns:

- request ID creation
- session loading
- trusted client IP extraction
- structured request logging
- safe unexpected-error mapping
- security headers
- rate-limit context wiring

Unexpected errors must be logged internally and returned to users as stable, safe error responses.

## Security

- Keep secrets server-only.
- Keep database clients and repositories server-only.
- Never log passwords, session tokens, raw SQL with sensitive parameters, or full request payloads.
- Treat all client input as untrusted, including route params and form data.
- Use server-side authorization for every privileged route and mutation.

## Testing

- Unit-test pure helpers and services.
- Add route tests for validation, authorization, rate limiting, and safe error behavior.
- Add UI smoke tests only after service and route behavior is covered.
