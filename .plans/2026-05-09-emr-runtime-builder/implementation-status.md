---
title: Runtime-First EMR And Dedicated EMR Builder Implementation Status
status: draft
owner: engineering
last_reviewed: 2026-05-13
plan_date: 2026-05-09
implementation_status: planning
---

# Implementation Status

## Current State

Architecture planning documentation has been created for a runtime-first EMR and a dedicated EMR Builder module. No application code, schemas, routes, migrations, or tests are implemented by this planning pass.

### VCMS-CPF Planning Update

- Added focused mobile planning in `docs/domains/emr-runtime/mobile.md`.
- Covered stack-neutral architecture, auth/session bootstrap, offline encrypted draft flow, barcode scan/manual capture, definition sync/versioning, local XLSForm-like validation/rendering, retry/idempotency behavior, conflict handling, and audit/security controls.
- Added ODK Collect parity mapping for migration planning and interoperability assessment.
- Documented the mobile API contract area for sync, drafts, conflict responses, and submit.

## Planning Decisions Captured

- Runtime comes before the Builder.
- The Builder is a dedicated module, not embedded in the runtime module.
- SurveyJS Creator is not part of the initial Builder direction.
- Patient barcode uniqueness belongs in PostgreSQL and service-level error handling.
- Signed clinical notes are immutable.
- Care pathways are versioned and branch from persisted runtime state.
- Runtime and Builder APIs use separate `/api/v1` route areas.
- Route security requirements apply from the first implementation pass.
- Focused Spark subagents should own bounded implementation, Svelte autofix, security audit, and documentation review passes.
- Staff mobile collection is planned as a dedicated delivery plane and stays within EMR runtime contracts (published definitions only, version-tied drafts, and auditable mutations).

## Not Started

- VCMS-CPF planning-to-code decomposition for mobile sync, encrypted draft store, and conflict-state handling.
- EMR runtime database schema.
- EMR Builder database schema.
- Runtime patient registration and encounter screens.
- Runtime clinical note capture.
- Builder definition administration screens.
- Care pathway branch evaluator.
- Privilege registry entries.
- API routes.
- Audit-log event implementation.
- Runtime and Builder tests.

## Next Implementation Gate

- Finalize mobile API/error/conflict contract with security subagent review before implementation.
- Confirm encrypted draft and key-management approach before code handoff.
  Before code starts, create or claim Beads issues for the runtime data model, runtime service/API surface, builder definition model, and security review. The first implementation pass should prove barcode uniqueness and immutable signed notes with tests before expanding UI workflows.
