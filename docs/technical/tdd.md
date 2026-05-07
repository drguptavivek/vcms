---
title: Test-Driven Development
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# Test-Driven Development

## Requirement

Business logic must be developed using TDD.

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
5. Add broader integration or regression coverage when the behavior crosses module boundaries.

## Required Coverage Areas

- Barcode formatting and padding.
- Sequence allocation.
- Manual sequence reset/set-next-number.
- Offline range reservation/skipping.
- Reprint behavior.
- Range overlap prevention.
- Serial upper limit handling.
- ReBAC authorization scope.
- ZPL and EPL generation.
- API validation error shape.

## Test Types

- Unit tests cover pure helpers, formatters, validation schemas, TOML privilege registry loading, ZPL/EPL generation, and error mappers.
- Service tests cover business behavior and use mocked repositories only when database behavior is not relevant.
- Repository tests use a real PostgreSQL test database.
- Route tests verify request validation, authentication, authorization, rate limiting, safe errors, and audit-log orchestration.
- Component tests verify user interaction and rendering behavior without duplicating service logic tests.
- Playwright tests cover high-value end-to-end smoke flows such as login, PEC setup, barcode batch generation, reprint, offline reserve, and printer template test print.

## Database Test Rules

- Use PostgreSQL for tests that depend on transactions, row locks, unique constraints, range overlap checks, or concurrency.
- Keep database tests isolated with transactional cleanup, schema reset, or per-test data factories.
- Do not replace concurrency-sensitive allocation tests with mocks.

## Coverage Expectations

- Prioritize meaningful coverage for barcode allocation, authorization, validation, printer generation, and audit behavior.
- Do not chase superficial UI coverage at the expense of business-rule coverage.
- Coverage reports should be generated through Vitest V8 coverage.

## Bug Fix Rule

Every business logic bug fix must include a regression test unless no practical test seam exists. If a regression test cannot be added, document why in the implementation notes.
