---
title: TDD And Testing Standard
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# TDD And Testing Standard

## Testing Stack

- Vitest for unit, service, repository, and route-level tests.
- `@testing-library/svelte` for Svelte component tests.
- Playwright for critical end-to-end smoke tests.
- PostgreSQL test database for repository/service integration tests.
- Vitest V8 coverage for coverage reporting.

## Workflow

1. Write or update a failing test that describes the expected behavior.
2. Implement the smallest correct change.
3. Run the relevant focused test.
4. Refactor while keeping tests green.
5. Add broader integration or regression coverage when behavior crosses module boundaries.
