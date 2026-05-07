---
title: Initial Barcode Management Application Plan
status: draft
owner: engineering
last_reviewed: 2026-05-07
plan_date: 2026-05-07
implementation_status: implemented_initial_app
---

# Implementation Plan: Barcode Management Application

## Summary

Build a SvelteKit + PostgreSQL application for generating, printing, reprinting, reserving, and auditing PEC barcode ranges using the barcode format `PP-YY-SSSSSS`.

## Core Decisions

- Use SvelteKit with TypeScript for UI and API routes.
- Use PostgreSQL as the authoritative database.
- Use Drizzle ORM for schema, migrations, and queries.
- Use Zod for API and form validation.
- Use Better Auth for authentication.
- Use local PostgreSQL-backed ReBAC authorization with OpenFGA-style relationship semantics.
- Use `smol-toml` for the central privilege registry.
- Use service/repository clean architecture.
- Use TDD for business logic.
- Use focused Spark subagents for planned implementation tasks where practical.
- Use a dedicated Spark subagent for route security audit before commit.
- Use a dedicated documentation subagent for every new or changed route/workflow.
- Apply explicit rate limiting to every API route.
- Use Vitest, `@testing-library/svelte`, Playwright, PostgreSQL test DB, and Vitest V8 coverage as the testing stack.

## Barcode Rules

- Format: `PP-YY-SSSSSS`.
- PEC code is numeric and printed as 2 digits.
- Barcode year is manually selected and controlled.
- Serial number is printed as 6 digits.
- Series reset/set-next-number is a privileged manual operation.
- Barcode batches must be generated transactionally with row-level locking.
- Printed, reserved, and skipped ranges must never overlap.
- Reprint must not allocate new numbers.

## Initial PEC Seed Data

| PEC Code | PEC Name          | Team |
| -------- | ----------------- | ---- |
| 17       | Trilokpuri        | 1    |
| 44       | Dharuhera         | 2    |
| 25       | Mehrauli          | 2    |
| 13       | Nangli            | 2    |
| 31       | Jaunapur          | 2    |
| 32       | Fatehpur Beri     | 2    |
| 54       | Madipur           | 4    |
| 16       | Jatkhor           | 3    |
| 50       | Sohna             | 3    |
| 34       | Tauru             | 3    |
| 46       | Patel Garden      | 3    |
| 43       | Janak puri        | 3    |
| 04       | Sanjay Colony     | 3    |
| 36       | Nangal Raya       | 4    |
| 45       | Chirag Delhi      | 4    |
| 39       | Basant Gaon       | 4    |
| 49       | Sarai Kale Khan   | 2    |
| 52       | Batla House       | 4    |
| 53       | Garhi             | 4    |
| 47       | Punjabi Bagh/SSMI | 5    |
| 99       | RIP/Camp          | 5    |
| 55       | Majnu ka Tila     | 5    |

## Planned Modules

```text
src/lib/server/
  modules/
    barcode/
    pecs/
    teams/
    users/
    printer-templates/
  auth/
  authz/
  db/
  observability/
```

## Planned API Areas

- `/api/v1/teams`
- `/api/v1/pecs`
- `/api/v1/users`
- `/api/v1/printer-templates`
- `/api/v1/barcode/batches`
- `/api/v1/barcode/batches/:id/reprint`
- `/api/v1/barcode/series`
- `/api/v1/barcode/series/reset`
- `/api/v1/barcode/ranges/reserve-offline`

## Testing Requirements

- Unit tests for formatting, validation, privilege registry loading, and printer language generation.
- Service tests for allocation, reset, reserve, reprint, and overlap checks.
- Authorization tests for admin and barcode print manager scopes.
- Concurrency tests proving duplicate ranges cannot be generated.
- Regression tests for all discovered barcode allocation bugs.
- Route tests proving validation, authorization, rate limiting, and safe error responses.
- Component tests with `@testing-library/svelte` for meaningful UI behavior.
- Playwright smoke tests for critical workflows only.
- PostgreSQL-backed repository/service tests for transaction, locking, constraint, and overlap behavior.

## Pre-Commit Route Gate

Every new or changed route must pass these checks before commit:

- TDD evidence: failing test added or updated before implementation.
- Spark implementation review: code-writing subagent reports scope, files changed, and tests run.
- Spark security audit: dedicated security subagent confirms authz coverage, validation coverage, rate-limit coverage, sensitive audit-log payload completeness, and safe error handling.
- Documentation audit: dedicated documentation subagent confirms technical and user-facing route/workflow docs were added or updated.
- Coordinator review: final agent reviews subagent outputs and verifies no unrelated work was overwritten.

## Documentation Deliverables

- Technical architecture documentation.
- Authorization and privilege registry documentation.
- Barcode lifecycle documentation.
- Printer template documentation.
- User-facing guides for admin and barcode print manager workflows.
