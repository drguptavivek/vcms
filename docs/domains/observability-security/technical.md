---
title: Observability Technical Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# Observability Technical Blueprint

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

Rate-limit and security logs include request ID, route path, actor when available, source IP where available, decision outcome, privilege when available, and retry-after value for `429` responses.

Application errors are written to `app_error_logs` with sanitized metadata. Raw SQL and secrets must not be exposed to users.
