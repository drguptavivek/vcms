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
