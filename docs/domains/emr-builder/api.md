---
title: EMR Builder API Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-09
---

# EMR Builder API Blueprint

## Planned Route Area

Prefer `/api/v1/emr-builder/**` for Builder administration endpoints.

Planned endpoint families:

- `definitions`: list, create, update drafts, validate, publish, retire.
- `sections`: manage reusable clinical sections.
- `fields`: manage field types, labels, validation, and display metadata.
- `pathways`: manage pathway nodes, branch conditions, and override policies.
- `versions`: inspect published versions and retirement state.

## Transport Rules

Routes transport data only. Business rules belong in `emr-builder.service.ts`, validation belongs in shared Zod schemas, and persistence belongs in `emr-builder.repository.ts`.

Every Builder route must use shared API helpers, request ID propagation, Zod validation, AuthZ, rate limiting, safe error responses, and structured logging.

## Stable Error Expectations

Builder APIs must never expose raw SQL errors. Expected safe errors include:

- invalid definition
- conflicting draft version
- published version cannot be edited
- definition in use cannot be deleted
- pathway graph has invalid branch target
- missing required validation rule
- unauthorized publish attempt
- validation failure
- rate limit exceeded

Each error response must include a request ID.
