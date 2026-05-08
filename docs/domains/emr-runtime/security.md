---
title: EMR Runtime Security Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-09
---

# EMR Runtime Security Blueprint

## Security Baseline

Every runtime API route needs explicit authentication, validation, AuthZ, rate limiting, safe error handling, and structured request logging.

Every runtime mutation needs a named privilege in `src/lib/server/authz/privileges.toml`.

## Privilege-Sensitive Actions

Runtime actions requiring audit logs include:

- patient create or update
- barcode assignment, reassignment, deactivation, or merge
- encounter creation or status change
- note signing
- note addendum
- note void or supersede
- pathway override
- privileged correction of runtime state

Audit records must include actor, action, resource, request ID, timestamp, reason where applicable, and before/after metadata where available.

## Rate Limits

Runtime mutations should use stricter rate limits than reads. Barcode reassignment, note signing, note correction, patient merge, and pathway override should use conservative limits.

Rate-limit failures must return stable `429` responses with request ID and safe retry guidance.

## Definition Visibility

Runtime users may access published definitions needed for care delivery. Unpublished Builder drafts, retired drafts, and Builder-only metadata must not be exposed through runtime routes unless the caller has explicit Builder privileges.
