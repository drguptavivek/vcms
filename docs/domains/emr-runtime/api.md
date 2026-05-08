---
title: EMR Runtime API Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-09
---

# EMR Runtime API Blueprint

## Implemented Route Areas

The current implementation uses focused `/api/v1/**` endpoint families instead of a single `/api/v1/emr-runtime/**` prefix. Keep this shape until there is a concrete migration reason; mobile/runtime routes are already separated by consumer.

Implemented endpoint families:

- `patients`: barcode lookup and registration.
- `encounters`: encounter creation and lookup by patient identifier.
- `care-pathways`: runtime pathway creation and listing by patient identifier.
- `clinical-notes/pec-opd`: PEC OPD note submission, immutable note version creation, and pathway/worklist side effects.
- `mobile/emr-definitions`: published definition manifest and rendered definition model for offline clients.
- `mobile/clinical-notes`: idempotent mobile PEC OPD submission.

## Implemented Routes

| Route                                           | Method | Purpose                                                               |
| ----------------------------------------------- | ------ | --------------------------------------------------------------------- |
| `/api/v1/patients?barcode=...`                  | `GET`  | Resolve patient by barcode.                                           |
| `/api/v1/patients`                              | `POST` | Create a patient for a validated barcode.                             |
| `/api/v1/encounters?patientId=...`              | `GET`  | List encounters by patient UUID.                                      |
| `/api/v1/encounters?patientBarcode=...`         | `GET`  | List encounters by barcode.                                           |
| `/api/v1/encounters`                            | `POST` | Create an encounter for a patient/PEC.                                |
| `/api/v1/care-pathways?patientId=...`           | `GET`  | List care pathways by patient UUID.                                   |
| `/api/v1/care-pathways?patientBarcode=...`      | `GET`  | List care pathways by barcode.                                        |
| `/api/v1/care-pathways`                         | `POST` | Create a pathway linked to one encounter and optional parent pathway. |
| `/api/v1/clinical-notes/pec-opd`                | `POST` | Submit PEC OPD note and create immutable note version.                |
| `/api/v1/mobile/emr-definitions`                | `GET`  | List active published definitions for mobile sync.                    |
| `/api/v1/mobile/emr-definitions/{definitionId}` | `GET`  | Fetch rendered model for one active published definition.             |
| `/api/v1/mobile/clinical-notes`                 | `POST` | Submit mobile PEC OPD note with idempotency key.                      |

## Transport Rules

Routes transport data only. Business rules belong in `emr-runtime.service.ts`, validation belongs in shared Zod schemas, and persistence belongs in `emr-runtime.repository.ts`.

Every route must use typed route `$types` where applicable, shared API helpers, request ID propagation, Zod validation, AuthZ, rate limiting, safe error responses, and structured logging.

Mutation routes must pass request ID, user ID, IP address, and user agent into the service layer for audit logging. Route contract coverage lives in `src/routes/api/v1/emr-runtime.route-contract.spec.ts`.

## Mobile Submission Contract

`POST /api/v1/mobile/clinical-notes` extends the web PEC OPD note payload with:

- `idempotencyKey`
- optional `definitionVersion`
- optional `definitionHash`
- optional `clientMetadata`
- optional `deviceMetadata`

The server hashes the clinical payload separately from transport metadata. Reusing the same idempotency key with the same payload returns the stored success response; reusing it with a different payload returns a conflict.

## Stable Error Expectations

Runtime APIs must never expose raw SQL errors. Expected safe errors include:

- duplicate active barcode
- patient not found
- encounter not found
- note already signed
- note draft not editable
- pathway version unavailable
- unauthorized pathway override
- validation failure
- rate limit exceeded
- idempotency key reused with changed payload
- active definition not found

Each error response must include a request ID.
