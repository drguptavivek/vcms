---
title: EMR Runtime Technical Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-09
---

# EMR Runtime Technical Blueprint

## Module Boundary

Runtime implementation should live under:

```text
src/lib/server/modules/emr-runtime/
  emr-runtime.schemas.ts
  emr-runtime.service.ts
  emr-runtime.repository.ts
  emr-runtime.types.ts
```

Routes and page loaders may call runtime service/controller entrypoints. They must not import runtime repositories directly.

The runtime may consume published Builder definitions through service contracts. It must not mutate Builder drafts, unpublished definitions, or Builder repository state.

## Runtime-First Sequence

1. Register and find patients.
2. Assign or verify barcode identity.
3. Create encounter context.
4. Capture draft clinical notes.
5. Sign notes into immutable records.
6. Add addenda or superseding correction records when needed.
7. Execute care pathway branches from persisted answers and versioned definitions.

## Barcode Uniqueness

Patient barcode uniqueness is a runtime identity rule:

- Each active barcode value maps to exactly one patient.
- PostgreSQL must enforce active barcode uniqueness.
- Service code must convert uniqueness failures into stable, safe API errors.
- Barcode reassignment, merge, and deactivation require named privileges and audit logs.
- Historical barcode records must be preserved for traceability.

## Immutable Notes

Draft notes may be edited until signing. Signed notes are immutable.

Corrections must be represented as separate records such as addenda, void/supersede records, or replacement versions with explicit lineage. Correction workflows must record the actor, reason, before/after metadata, request ID, and timestamps.

Every signed note must preserve:

- patient
- encounter
- author
- signed timestamp
- source definition version
- structured payload
- request ID or trace context

## Care Pathway Branching

Care pathway decisions must be deterministic and reproducible. Branch inputs may include structured note answers, patient attributes, encounter type, service location, clinician role, and privileged manual overrides with reason.

Published pathway versions must not be edited in place after runtime use. Later changes require a new published version.

## Client Boundary

Svelte components may render runtime state, collect input, and submit forms or JSON requests. They must not import database clients, auth internals, runtime repositories, Builder repositories, or server-only modules.
