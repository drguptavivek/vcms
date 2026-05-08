---
title: EMR Runtime API Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-09
---

# EMR Runtime API Blueprint

## Planned Route Area

Prefer `/api/v1/emr-runtime/**` for runtime JSON endpoints.

Planned endpoint families:

- `patients`: registration, lookup, duplicate review, and barcode identity.
- `encounters`: encounter creation, lookup, and status transitions.
- `notes`: draft creation, draft update, signing, addenda, void, and supersede.
- `pathways`: runtime pathway selection, branch evaluation, and override.

## Transport Rules

Routes transport data only. Business rules belong in `emr-runtime.service.ts`, validation belongs in shared Zod schemas, and persistence belongs in `emr-runtime.repository.ts`.

Every route must use typed route `$types` where applicable, shared API helpers, request ID propagation, Zod validation, AuthZ, rate limiting, safe error responses, and structured logging.

## Stable Error Expectations

Runtime APIs must never expose raw SQL errors. Expected safe errors include:

- duplicate active barcode
- patient not found
- encounter not found
- note already signed
- note draft not editable
- pathway version unavailable
- unauthorized pathway override
- validation failure
- rate limit exceeded

Each error response must include a request ID.
