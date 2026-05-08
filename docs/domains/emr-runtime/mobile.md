---
title: EMR Runtime Mobile Collection Planning
status: draft
owner: engineering
last_reviewed: 2026-05-09
---

# EMR Runtime Mobile Collection Planning

## Issue Context

This document defines the planning scope for **VCMS-CPF**: a staff mobile collection app that captures clinical encounters from published EMR definitions for offline and intermittent-network environments.

The app is stack-neutral and defined as a client that consumes server APIs only:

- no device platform assumptions
- no mobile UI framework assumptions
- no Android/iOS implementation details in this plan

## Objectives

- Capture encounter and form data in the field without network dependence.
- Trust only published EMR definitions (runtime-read only).
- Keep draft data encrypted at rest on the device and synchronized safely with conflict-aware flows.
- Preserve clinical correctness through immutable record submission, idempotent retries, and strong conflict handling.
- Maintain parity with ODK Collect behavior while keeping VCMS authentication and privilege/audit contracts.

## Stack-Neutral Client Architecture

Define a protocol-first mobile client boundary:

```text
Mobile Client -> Sync APIs -> emr-runtime service -> repository -> PostgreSQL/queue/audit
```

The client should include:

- Session bootstrap + auth exchange
- Definition catalog/cache
- Offline-first draft store
- Submit queue + retry manager
- Conflict resolution state machine
- Validation/rendering engine

All client internals remain outside the VCMS server; no server repository imports.

## Auth and Session Contract

- Staff authenticate through Better Auth session bootstrap used by the VCMS backend.
- Mobile-specific token flow is required to avoid shared cookie assumptions:
  - `POST /api/v1/auth/mobile/login`: exchange user credentials/session grant for a short-lived mobile token.
  - Token includes user role claims and scope; runtime APIs enforce standard ReBAC checks.
  - Refresh token flow refreshes short-lived access tokens without re-entering credentials.
- Every mobile call includes a request context ID and is traceable through server structured logs and audit entries.
- Sensitive operations require explicit privileges via existing privilege registry and remain named in route security policy.

## Barcode Capture: Scan and Manual Entry

The app must support two equivalent input methods:

1. Camera decode path for barcode scan.
2. Manual numeric entry path for low-light, damaged-barcode, or unsupported-device capture scenarios.

Common behavior:

- Local barcode normalization at entry.
- Local fast-fail checks for format and checksum before network lookup.
- API validation on `/api/v1/emr-runtime/patients:resolve-barcode` and `/api/v1/emr-runtime/encounters`.
- If barcode maps to active patient, load active encounter draft context; if unknown, prompt patient registration flow.

## Offline Encrypted Draft Strategy

Drafts are created per patient encounter and kept in an encrypted local store:

- `draft_session` fields:
  - `draftId`
  - `encounterId` / `patientId` / `barcode`
  - `definitionVersion`
  - `formState`, `validationState`, `deviceMeta`
  - `localVersion` and `lastSyncAt`
- Encryption rules:
  - Draft payload encrypted with device-key-backed symmetric key.
  - Encryption keys stored in platform secure storage (or secure equivalent on web/PWA).
  - No raw PHI/PII in sync queue metadata.
- Draft deletion policy:
  - auto-delete after successful hard submission + retention window.
  - keep minimal tamper evidence record for audit follow-up.

## Definition Sync and Versioning

- The app synchronizes only with published definitions.
- Implemented mobile sync contract returns:
  - `definitionId`
  - `definitionVersion`
  - `versionHash`
  - `updatedAt`
  - cache metadata (`cacheKey`, `etag`, `maxAgeSeconds`)
- `GET /api/v1/mobile/emr-definitions`
  - manifest of active published definitions with cache metadata
- `GET /api/v1/mobile/emr-definitions/{definitionId}`
  - rendered model for one active definition version with cache metadata
- Client behavior:
  - fetch manifest first (lightweight)
  - fetch full definition payload only when manifest cache metadata changed
  - background refresh on app resume and periodic retry windows
- Publishing a new definition version never mutates prior versions. Runtime consumes an explicit version per draft.
- If a newer version is required while a draft exists:
  - keep draft editable in its version.
  - mark as `version-deferred`.
  - prompt user at next sync boundary when mandatory migration policy is active.

## Local XLSForm-like Validation and Rendering

The client renders fields from the definition DSL, independent of platform:

- Type primitives: text, int/decimal, date/time, select, repeat-like groups, calculated/read-only fields.
- Constraint model:
  - required, min/max, pattern, range, relevance, calculations.
  - choice label/label-enrichment metadata from published definition.
- Client-side pre-validation:

1.  required/relevance/canonical type check
2.  constraint checks before queueing for submission
3.  localized validation message mapping

- Server-side validation remains authoritative.

This preserves XLSForm-like UX expectations while using VCMS’s published schema model and error codes.

## Submission, Retry, and Idempotency

Each draft submission includes a stable `submissionId`/`idempotencyKey`.

- Client rules:
  - generate key before first submit attempt.
  - never regenerate for retries of the same draft state.
  - mark attempts and next attempt time using exponential backoff with bounded jitter.
- Server rules:
  - idempotency lookup by key before creating durable server state.
  - identical replay returns prior result if payload hash unchanged.
  - changed payload with same key returns deterministic conflict response for explicit re-sync.
- Network recovery:
  - 202/409/422/429 mapped to controlled retry.
  - fatal statuses create local "needs attention" state.

## Conflict Handling

Server can return conflict payloads for:

- definition drift (`definitionVersion` mismatch)
- barcode reassignment or merge
- draft lifecycle drift (draft already signed/voided)
- encounter state changes

Client conflict process:

1. pause queue item
2. persist immutable conflict record in local store
3. refresh patient/encounter/definition context
4. rebase or create replacement draft if allowed
5. require explicit user action when irreversible

## Audit, Security, and Privacy

- Server must emit audit events for mobile submit/retry paths equivalent to web workflows:
  - actor, action, resource, request ID, session context
  - before/after snapshots where practical
  - reason for overrides/retries/sign-off
- Mobile transport security:
  - HTTPS only
  - request body hashing for sensitive mutation payloads
  - stable 429 handling with safe retry guidance and request ID.
- Error hygiene:
  - no raw SQL or stack traces.
  - only stable codes/messages plus remediation hints.
- Draft encryption and secure key lifecycle are security requirements, not optional optimizations.

## ODK Collect Parity

### Expected parity points

- Offline capture with queued submissions.
- Encrypted on-device instance storage.
- Idempotent submission semantics.
- Barcode-driven context resolution.
- Definition-driven form rendering and validation.

### VCMS-specific deltas

- Runtime consumes only published EMR versions and binds draft state to explicit `definitionVersion`.
- ReBAC privilege enforcement and route-level auditing are mandatory for every mutation.
- Signed-note and addenda model must preserve clinical correction semantics.
- Mobile submission path emits VCMS audit/log contract and request-id discipline.

### Future interop notes

If ODK Collect reuse is considered later, parity points above become interoperability checkpoints, not a binding requirement for this phase.

## API Contract Area (Planning Scope)

- `GET /api/v1/mobile/emr-definitions`
  list published definitions and version manifest
- `GET /api/v1/mobile/emr-definitions/{definitionId}`
  fetch a specific published definition version
- `POST /api/v1/mobile/clinical-notes`
  submit a PEC OPD note with idempotency key, optional definition version/hash, client metadata, and device metadata

Planned future routes:

- `POST /api/v1/mobile/drafts`
  create server-visible draft metadata and open sync state if server-side draft sync is required
- `PATCH /api/v1/mobile/drafts/{draftId}`
  upsert draft JSON with conflict-safe revision checks if server-side draft sync is required
- `POST /api/v1/mobile/sync`
  batch upload/download sync state and delivery status
- `GET /api/v1/mobile/encounters/{encounterId}/state`
  resolve barcode state and latest encounter envelope

All listed routes must remain request-ID aware, rate-limited, validated through shared Zod schemas, and audited.

## Migration and Acceptance Milestones

1. Definition manifest + sync baseline
2. Barcode resolve + local form renderer skeleton
3. Encrypted draft storage + offline queue
4. Idempotent submit + conflict response contract
5. Security hardening, audits, and parity checks with ODK-like workflows
6. End-to-end smoke: scan/manual entry -> offline capture -> sync -> server accept
