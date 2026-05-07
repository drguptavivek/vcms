---
title: Security
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# Security

## Route Security Baseline

Every API route must explicitly define and enforce:

- input validation
- authentication requirement
- authorization privilege and resource scope where applicable
- rate-limit policy
- structured runtime logging
- safe error response mapping
- audit logging for privilege-sensitive operations

## Rate Limiting

Every API route must have an explicit rate-limit policy.

Recommended default categories:

- authentication routes: strict limits by IP and account identifier
- read-only authenticated routes: moderate limits by user and IP
- mutation routes: stricter limits by user, IP, and resource
- barcode allocation routes: strict limits by user, PEC, and year
- manual reset and offline reservation routes: very strict limits with mandatory reason capture

Rate-limit failures must return a stable `429` API response with:

- stable error code
- request ID
- safe message
- retry guidance

## Spark Security Audit Requirement

Every new or changed route requires a dedicated Spark security-audit subagent before commit.

The security-audit subagent must verify:

- route uses shared validation and error handling
- required authentication is present
- required authorization uses a named TOML privilege
- resource scope is correct
- rate-limit policy is present and appropriate
- sensitive mutations create audit logs
- SQL/runtime errors are sanitized before reaching users
- no secrets, tokens, or raw SQL are logged
- tests cover validation, authorization, rate limiting, and safe errors where practical

The audit result must be included in the implementation handoff.

## Documentation Subagent Requirement

Every new or changed route, workflow, or privilege-sensitive feature requires a dedicated documentation subagent before commit.

The documentation subagent must verify:

- technical route/API documentation is current
- user-facing workflow documentation is current when behavior affects users
- privilege and audit behavior is documented
- rate-limit behavior is documented when users may encounter it
- examples do not contain real secrets or patient data

## Implementation Subagent Requirement

Planned functionality should be implemented using focused Spark code-writing subagents where practical.

Each implementation subagent must:

- receive a bounded ownership area
- follow TDD
- avoid overwriting unrelated work
- report files changed
- report tests added and run
- report assumptions and remaining risks
