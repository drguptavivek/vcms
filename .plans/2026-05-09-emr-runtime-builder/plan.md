---
title: Runtime-First EMR And Dedicated EMR Builder Plan
status: draft
owner: engineering
last_reviewed: 2026-05-09
plan_date: 2026-05-09
implementation_status: planning
---

# Runtime-First EMR And Dedicated EMR Builder Plan

## Summary

Build the EMR as a runtime-first clinical workflow before building a dedicated EMR Builder. The first useful system must register patients, guarantee barcode uniqueness, capture immutable clinical notes, and route each patient through configured care pathways. The Builder then becomes an administrative module for versioned clinical definitions, not a dependency for the first runtime screens.

## Runtime-First Sequence

1. Patient registration and lookup.
2. Barcode assignment with database-enforced uniqueness.
3. Encounter creation for a patient and visit context.
4. Runtime note capture using server-owned schemas and clinical section definitions.
5. Immutable note append/sign workflow with corrections recorded as new versions or addenda.
6. Care pathway selection and branching from runtime answers, clinical state, or manual clinician action.
7. Builder-managed definition versioning after the runtime contract is stable.

The runtime must not wait for a visual form builder. Early screens may use hand-built Svelte components backed by versioned runtime definitions.

## Module Boundaries

Runtime module:

```text
src/lib/server/modules/emr-runtime/
  emr-runtime.schemas.ts
  emr-runtime.service.ts
  emr-runtime.repository.ts
  emr-runtime.types.ts
```

Builder module:

```text
src/lib/server/modules/emr-builder/
  emr-builder.schemas.ts
  emr-builder.service.ts
  emr-builder.repository.ts
  emr-builder.types.ts
```

The EMR runtime owns patient-facing and clinician-facing execution: patient registration, encounter state, note capture, note immutability, pathway execution, and runtime audit events.

The EMR Builder owns administrative definition management: section templates, field definitions, validation rules, pathway graphs, publish workflows, version metadata, and retirement policy.

Runtime code may read published builder definitions through service contracts. Runtime code must not import builder repositories directly, and builder code must not mutate clinical runtime records.

## Rejected Direction

Do not use SurveyJS Creator for the initial EMR Builder. The Builder must follow the project module architecture, privilege registry, audit model, and clinical immutability expectations. Reusable concepts such as field types, validation hints, and branching definitions may be modeled internally, but the admin experience should remain a purpose-built VCMS feature.

## Patient And Barcode Rules

- A patient may have zero or more historical identifiers, but each active barcode value must belong to exactly one patient.
- Barcode uniqueness must be enforced in PostgreSQL with a unique index or constraint, not only in service code.
- Duplicate barcode attempts must return a stable safe API error with request ID.
- Barcode reassignment is privilege-sensitive and must preserve before/after audit records.
- Patient merge or duplicate-resolution workflows must not delete barcode history.

## Immutable Clinical Notes

- Signed notes are immutable.
- Corrections are represented as addenda, replacement versions, or explicit void/supersede records.
- The note record must preserve author, timestamps, encounter, patient, source definition version, and request ID.
- Draft notes may be edited until signing, subject to ownership and role rules.
- Audit logs must capture sign, addendum, void, supersede, and privileged correction actions.

## Care Pathway Branching

Care pathways are versioned clinical workflow definitions. Runtime branching may depend on:

- structured answer values
- patient age or registration attributes
- encounter type
- clinician role or service location
- manual pathway override with reason

Branch decisions must be reproducible from persisted runtime inputs and definition versions. A published pathway version must not be edited in place after patients have used it.

## API And Security Expectations

- Prefer `/api/v1/emr-runtime/**` for runtime JSON endpoints.
- Prefer `/api/v1/emr-builder/**` for builder administration endpoints.
- Every mutation needs a named privilege in `src/lib/server/authz/privileges.toml`.
- Every API route needs explicit validation, AuthZ, rate limiting, safe error mapping, and request ID propagation.
- Builder publication, note signing, note correction, pathway override, barcode reassignment, and patient merge are privilege-sensitive and require audit logs.
- Runtime routes must not expose unpublished builder definitions unless the caller has builder privileges.
- Client modules must not import server-only runtime, builder, database, auth, or repository code.

## Spark Subagent Execution Model

Use bounded Spark subagents for implementation phases where practical:

- runtime data-model and repository pass
- runtime service and API pass
- runtime Svelte screen pass with project Svelte MCP documentation lookup
- builder definition-model pass
- builder admin UI pass with project Svelte MCP documentation lookup
- route security-audit pass for changed routes
- documentation pass for changed workflows, privileges, and routes

Each code-writing Svelte pass must run `svelte.svelte-autofixer` on every changed `.svelte` file until clean and report the changed files plus verification commands.

## Testing Expectations

- Use TDD for runtime business rules.
- Unit-test note immutability, pathway branch evaluation, barcode uniqueness error mapping, and builder definition validation.
- Repository or DB-backed tests must cover uniqueness constraints, transactional note signing, published definition version locking, and concurrent barcode assignment.
- Route tests must cover validation, AuthZ, rate limits, safe errors, audit side effects, and unpublished-definition access control.
- Component tests must cover clinician note capture, pathway branching display, builder definition editing, publish confirmations, and validation hints.
- Playwright should be limited to critical registration, note signing, pathway branch, and builder publish smoke tests.

## Documentation Deliverables

- `docs/domains/emr-runtime/index.md`
- `docs/domains/emr-runtime/technical.md`
- `docs/domains/emr-runtime/api.md`
- `docs/domains/emr-runtime/security.md`
- `docs/domains/emr-runtime/testing.md`
- `docs/domains/emr-runtime/user-guide.md`
- `docs/domains/emr-builder/index.md`
- `docs/domains/emr-builder/technical.md`
- `docs/domains/emr-builder/api.md`
- `docs/domains/emr-builder/security.md`
- `docs/domains/emr-builder/testing.md`
- `docs/domains/emr-builder/user-guide.md`
