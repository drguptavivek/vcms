---
title: EMR Runtime Technical Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-12
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

## openEHR Composition Persistence

Clinical runtime submissions are persisted as openEHR Compositions in the configured CDR. The application layer may keep operational rows for idempotency, workflow queues, local audit, and user-facing status, but it must not treat the local clinical note JSON as the longitudinal clinical source of truth.

For the first EHRbase bridge slice, runtime submission uses FLAT Web Template payloads. The local clinical note version stores:

- `ehr_id`
- Composition UID/version reference
- template ID
- Composition format
- hash of the submitted FLAT payload
- hash of the local submission envelope

This lets VCMS preserve traceability without duplicating the clinical Composition body into local operational tables.

## openEHR Template Registry

The reusable platform layer keeps CDR template metadata outside VCMS-specific form definitions:

- `openehr_templates`: local registry for uploaded CDR template IDs, archetype IDs, hashes, status, and Web Template root IDs.
- `openehr_web_template_caches`: current cached Web Template JSON and hash for runtime rendering and path validation.

This registry is intentionally generic. VCMS Builder definitions, future non-VCMS applications, mobile runtime forms, and reporting modules should reference this template registry instead of duplicating Web Template JSON or hard-coding clinical template paths.

The first Template Registry API slice exposes this boundary through `/api/v1/openehr/templates`. Runtime manifests are derived from cached Web Template JSON rather than hand-authored local schema. Each manifest carries stable enough application metadata for a form renderer:

- root template and Web Template hash.
- section-like nodes for navigation/grouping.
- field nodes with base FLAT paths.
- input suffix paths for values, coded values, terminology, units, and other Web Template inputs.
- required, repeating, and in-context flags.
- local value lists and terminology hints.

The manifest is a rendering and submission guide, not a clinical source of truth. EHRbase remains authoritative for template validation and Composition persistence.

The first Template Registry admin UI is available at `/emr-builder/openehr`. It calls the generic Template Registry API, so it remains a reusable openEHR platform screen rather than a VCMS-specific clinical form editor. The screen supports OPT upload, existing CDR template sync, local registry review, and runtime manifest inspection.

`npm run ehrbase:smoke` is the local integration proof for the current bridge. It exercises template availability, Web Template retrieval, EHR creation, FLAT Composition commit, and AQL lookup against the running EHRbase container.

## Curated AQL Query Service

The reusable openEHR layer exposes AQL through a curated query registry, not a raw query endpoint. This keeps CDR retrieval governed by application policy while still using EHRbase as the source of truth for Composition retrieval.

The first query service slice defines named query IDs for common Composition lookup tasks:

- `composition.list_by_ehr`
- `composition.list_by_template`
- `composition.get_by_uid`

Each query definition owns its allowed parameters, default fetch count, maximum fetch count, and raw AQL text. API callers can list query metadata and execute one named query with validated parameters. Raw AQL text remains server-side.

Clinical query execution requires `emr.aql.query`, uses read rate limits, and writes an audit record with query ID, parameter names, pagination, and row count.

## Immutable Notes And Corrections

Draft notes may be edited until signing. Signed clinical records are CDR Compositions and are immutable in the application model.

Corrections must be represented as new CDR commits with explicit lineage such as amendment, correction, void/supersede, or addendum semantics. Correction workflows must record the actor, reason, before/after metadata, request ID, and timestamps.

Every signed runtime record must preserve or be able to resolve:

- patient and `ehr_id`
- encounter context
- author/committer
- signed/committed timestamp
- source template/version
- Composition UID/version reference
- request ID or trace context

## Care Pathway Branching

Care pathway decisions must be deterministic and reproducible. Branch inputs may include structured note answers, patient attributes, encounter type, service location, clinician role, and privileged manual overrides with reason.

Published pathway versions must not be edited in place after runtime use. Later changes require a new published version.

## Client Boundary

Svelte components may render runtime state, collect input, and submit forms or JSON requests. They must not import database clients, auth internals, runtime repositories, Builder repositories, or server-only modules.
