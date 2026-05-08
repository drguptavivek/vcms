---
title: EMR Builder Domain Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-09
---

# EMR Builder Domain Blueprint

## Scope

The EMR Builder is a dedicated administrative module for clinical definition management. It owns section templates, field definitions, validation rules, care pathway graphs, publish workflows, version metadata, and retirement policy.

The Builder does not own patient runtime records, encounters, signed notes, or runtime pathway execution.

## Documents

- `technical.md`: Builder module boundary, versioning model, and published-definition rules.
- `api.md`: planned Builder API areas and transport expectations.
- `security.md`: Builder privileges, publication audit, and definition visibility.
- `testing.md`: expected Builder unit, route, DB, component, and smoke coverage.
- `user-guide.md`: Builder administrator workflow outline.

## Related Domains

- `../emr-runtime/`: runtime execution of published definitions.
- `../identity-access/`: users, roles, ReBAC, and privilege registry.
- `../observability-security/`: API wrapper, logging, audit, rate limiting, and safe errors.

## Related Plan

- `../../../.plans/2026-05-09-emr-runtime-builder/plan.md`
