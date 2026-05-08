---
title: Runtime-First EMR And Dedicated EMR Builder Implementation Status
status: draft
owner: engineering
last_reviewed: 2026-05-09
plan_date: 2026-05-09
implementation_status: planning
---

# Implementation Status

## Current State

Architecture planning documentation has been created for a runtime-first EMR and a dedicated EMR Builder module. No application code, schemas, routes, migrations, or tests are implemented by this planning pass.

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

## Not Started

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

Before code starts, create or claim Beads issues for the runtime data model, runtime service/API surface, builder definition model, and security review. The first implementation pass should prove barcode uniqueness and immutable signed notes with tests before expanding UI workflows.
