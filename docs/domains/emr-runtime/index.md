---
title: EMR Runtime Domain Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-09
---

# EMR Runtime Domain Blueprint

## Scope

The EMR runtime covers patient registration, barcode identity, encounters, clinician note capture, immutable signed notes, addenda and corrections, care pathway execution, and patient-facing workflow state.

The runtime is the first implementation priority. It must be usable with hand-built Svelte screens and server-owned clinical definitions before the dedicated EMR Builder is complete.

## Documents

- `technical.md`: runtime module boundary, data rules, note immutability, and care pathway behavior.
- `api.md`: planned runtime API areas and transport expectations.
- `security.md`: runtime privileges, audit events, rate limits, and safe errors.
- `testing.md`: expected runtime unit, route, DB, component, and smoke coverage.
- `user-guide.md`: clinician and operator workflow outline.

## Related Domains

- `../emr-builder/`: builder-managed definition versions used by the runtime.
- `../barcode/`: existing barcode allocation and print lifecycle.
- `../identity-access/`: users, roles, ReBAC, and privilege registry.
- `../observability-security/`: API wrapper, logging, audit, rate limiting, and safe errors.
- Future mobile collection app: staff-facing offline-capable client that syncs published EMR
  definitions, captures drafts against barcodes, and submits notes through the runtime APIs.

## Related Plan

- `../../../.plans/2026-05-09-emr-runtime-builder/plan.md`
