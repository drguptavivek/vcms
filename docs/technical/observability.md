---
title: Observability
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# Observability

## Runtime Logs

Runtime logs must include:

- request ID
- user ID when available
- route/action
- status code
- duration
- sanitized error details

## SQL Error Logs

SQL errors must be logged internally with sanitized details and stable error codes. Raw SQL internals must not be exposed to users.

## Audit Logs

Audit logs are required for privilege-sensitive actions, including:

- PEC creation/update/deactivation
- user role assignment
- PEC allocation
- barcode batch generation
- reprint
- offline range reservation
- manual sequence reset
- printer template changes

## Rate-Limit And Security Telemetry

Rate-limit and security logs must include:

- request ID
- route/action
- actor when available
- source IP or trusted forwarded client IP
- decision outcome
- rate-limit policy name
- retry-after value when applicable
- authorization policy or privilege name when applicable

Blocked requests must be logged without exposing secrets, passwords, session tokens, raw SQL, or full request payloads.

The API handler writes sanitized failures to `app_error_logs` and returns `Retry-After` headers for rate-limit responses.
