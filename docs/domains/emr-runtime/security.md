---
title: EMR Runtime Security Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-09
---

# EMR Runtime Security Blueprint

## Security Baseline

Every runtime API route needs explicit authentication, validation, AuthZ, rate limiting, safe error handling, and structured request logging.

Every runtime mutation needs a named privilege in `src/lib/server/authz/privileges.toml`.

## Privilege-Sensitive Actions

Runtime actions requiring audit logs include:

- patient create or update
- barcode assignment, reassignment, deactivation, or merge
- encounter creation or status change
- note signing
- note addendum
- note void or supersede
- pathway override
- privileged correction of runtime state

Audit records must include actor, action, resource, request ID, timestamp, reason where applicable, and before/after metadata where available.

## Rate Limits

Runtime mutations should use stricter rate limits than reads. Barcode reassignment, note signing, note correction, patient merge, and pathway override should use conservative limits.

Rate-limit failures must return stable `429` responses with request ID and safe retry guidance.

## Definition Visibility

Runtime users may access published definitions needed for care delivery. Unpublished Builder drafts, retired drafts, and Builder-only metadata must not be exposed through runtime routes unless the caller has explicit Builder privileges.

## Implemented Route Review

Reviewed on 2026-05-09 after the runtime, mobile sync, and builder-contract test work.

| Route                                           | Method | Privilege                                | Rate limit | Validation                                 | Audit behavior                                                         |
| ----------------------------------------------- | ------ | ---------------------------------------- | ---------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `/api/v1/patients`                              | `GET`  | `emr.patient.view`                       | read       | `patientLookupSchema` query parse          | failure audit from API wrapper                                         |
| `/api/v1/patients`                              | `POST` | `emr.patient.create` scoped to PEC       | mutation   | `patientCreateSchema`                      | `PatientService.createForBarcodeWithAudit`                             |
| `/api/v1/encounters`                            | `GET`  | `emr.encounter.view`                     | read       | `encounterListQuerySchema` query parse     | failure audit from API wrapper                                         |
| `/api/v1/encounters`                            | `POST` | `emr.encounter.create` scoped to PEC     | mutation   | `encounterCreateSchema`                    | `EncounterService.createForRequest`                                    |
| `/api/v1/care-pathways`                         | `GET`  | `emr.care_pathway.view`                  | read       | `carePathwayListQuerySchema` query parse   | failure audit from API wrapper                                         |
| `/api/v1/care-pathways`                         | `POST` | `emr.care_pathway.create`                | mutation   | `carePathwayCreateSchema`                  | `CarePathwayService.createForRequest`                                  |
| `/api/v1/clinical-notes/pec-opd`                | `POST` | `emr.clinical_note.submit` scoped to PEC | sensitive  | `submitPecOpdNoteSchema`                   | `ClinicalNoteService.submitPecOpdNote`                                 |
| `/api/v1/mobile/clinical-notes`                 | `POST` | `emr.clinical_note.submit` scoped to PEC | sensitive  | `submitPecOpdMobileNoteSchema`             | idempotent `ClinicalNoteService.submitPecOpdNoteWithMobileIdempotency` |
| `/api/v1/mobile/emr-definitions`                | `GET`  | `emr.runtime.mobile_definition.view`     | read       | none, manifest only                        | failure audit from API wrapper                                         |
| `/api/v1/mobile/emr-definitions/{definitionId}` | `GET`  | `emr.runtime.mobile_definition.view`     | read       | `emrBuilderDefinitionIdSchema` param parse | failure audit from API wrapper                                         |

The route contract is pinned by `src/routes/api/v1/emr-runtime.route-contract.spec.ts`.

## Current Security Notes

- PEC-scoped mutations use `resource: (body) => ({ type: 'pec', id: ... })` where the request body carries a PEC identifier.
- `care_pathway.create` is currently system-scoped because its request body identifies patient and encounter, not PEC. The service validates the encounter belongs to the patient before creating the pathway and writes a patient-resource audit entry.
- Mobile note submission stores idempotency state by user and idempotency key. Replays with the same payload return the stored success result; key reuse with a different payload returns a conflict.
- Runtime clinical payload bodies are committed to EHRbase before local note version rows are written. Local note versions store only the accepted openEHR reference plus local and FLAT payload hashes.
- CDR error responses must be normalized before returning through runtime APIs. API clients may receive the safe error code, status, and a response-body hash for support correlation, but not raw EHRbase rejection bodies.
