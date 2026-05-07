---
title: Security Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# Security Blueprint

## Route Security Baseline

Every API route must explicitly define and enforce:

- input validation
- authentication requirement
- authorization privilege and resource scope where applicable
- rate-limit policy
- structured runtime logging
- safe error response mapping
- audit logging for privilege-sensitive operations

## Spark Security Audit Requirement

Every new or changed route requires a dedicated Spark security-audit subagent before commit.

The security-audit subagent must verify validation, authentication, authorization, resource scope, rate limiting, audit logs, sanitized errors, safe logging, and relevant tests.

## Current Route Security Implementation

- API routes use the shared `withApiHandler` wrapper.
- The wrapper applies request ID propagation, JSON parsing, Zod validation, authentication, optional ReBAC authorization, rate limiting, safe error envelopes, and structured error logging.
- Sensitive barcode, user-management, and printer-template mutations use stricter rate-limit policies.
- Privilege-sensitive services write audit logs with action, actor, resource, reason where applicable, and before/after data where available.
