---
title: EMR Builder Security Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-09
---

# EMR Builder Security Blueprint

## Security Baseline

Every Builder API route needs explicit authentication, validation, AuthZ, rate limiting, safe error handling, and structured request logging.

Every Builder mutation needs a named privilege in `src/lib/server/authz/privileges.toml`.

## Privilege-Sensitive Actions

Builder actions requiring audit logs include:

- definition draft create or update
- field or section structural change
- validation rule change
- pathway graph change
- publish
- retire
- rollback or supersede
- manual correction of definition metadata

Audit records must include actor, action, resource, request ID, timestamp, reason where applicable, and before/after metadata where available.

## Publication Boundary

Publishing a definition makes it available to runtime workflows. Publication must verify schema validity, pathway graph validity, branch target integrity, privilege coverage for sensitive actions, and compatibility with runtime consumers.

Published definitions must not be edited in place after runtime use.

## Rate Limits

Builder reads can use standard authenticated read limits. Draft mutation, publish, retire, rollback, and pathway graph updates should use stricter administrative mutation limits.
