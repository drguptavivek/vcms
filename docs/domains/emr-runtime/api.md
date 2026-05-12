---
title: EMR Runtime API Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-12
---

# EMR Runtime API Blueprint

## Implemented Route Areas

The current implementation uses focused `/api/v1/**` endpoint families instead of a single `/api/v1/emr-runtime/**` prefix. Keep this shape until there is a concrete migration reason; mobile/runtime routes are already separated by consumer.

Implemented endpoint families:

- `patients`: barcode lookup and registration.
- `encounters`: encounter creation and lookup by patient identifier.
- `care-pathways`: runtime pathway creation and listing by patient identifier.
- `clinical-notes/pec-opd`: PEC OPD note submission to EHRbase as an openEHR Composition, local reference/version tracking, and pathway/worklist side effects.
- `openehr/templates`: reusable openEHR Template Registry, OPT upload/sync, cached Web Template manifest generation.
- `openehr/aql/queries`: governed curated AQL query registry and execution.
- `mobile/emr-definitions`: published definition manifest and rendered definition model for offline clients.
- `mobile/clinical-notes`: idempotent mobile PEC OPD submission.

## Implemented Routes

| Route                                               | Method | Purpose                                                               |
| --------------------------------------------------- | ------ | --------------------------------------------------------------------- |
| `/api/v1/patients?barcode=...`                      | `GET`  | Resolve patient by barcode.                                           |
| `/api/v1/patients`                                  | `POST` | Create a patient for a validated barcode.                             |
| `/api/v1/encounters?patientId=...`                  | `GET`  | List encounters by patient UUID.                                      |
| `/api/v1/encounters?patientBarcode=...`             | `GET`  | List encounters by barcode.                                           |
| `/api/v1/encounters`                                | `POST` | Create an encounter for a patient/PEC.                                |
| `/api/v1/care-pathways?patientId=...`               | `GET`  | List care pathways by patient UUID.                                   |
| `/api/v1/care-pathways?patientBarcode=...`          | `GET`  | List care pathways by barcode.                                        |
| `/api/v1/care-pathways`                             | `POST` | Create a pathway linked to one encounter and optional parent pathway. |
| `/api/v1/clinical-notes/pec-opd`                    | `POST` | Submit PEC OPD Composition and store the local openEHR reference.     |
| `/api/v1/openehr/templates?status=...`              | `GET`  | List locally registered openEHR templates.                            |
| `/api/v1/openehr/templates`                         | `POST` | Upload an ADL 1.4 OPT to EHRbase and cache its Web Template.          |
| `/api/v1/openehr/templates/sync`                    | `POST` | Sync an existing CDR template and refresh its local Web Template.     |
| `/api/v1/openehr/templates/manifest?templateId=...` | `GET`  | Build a runtime form manifest from the cached Web Template.           |
| `/api/v1/openehr/aql/queries`                       | `GET`  | List registered curated AQL queries.                                  |
| `/api/v1/openehr/aql/queries/execute`               | `POST` | Execute one registered AQL query with validated parameters.           |
| `/api/v1/mobile/emr-definitions`                    | `GET`  | List active published definitions for mobile sync.                    |
| `/api/v1/mobile/emr-definitions/{definitionId}`     | `GET`  | Fetch rendered model for one active published definition.             |
| `/api/v1/mobile/clinical-notes`                     | `POST` | Submit mobile PEC OPD note with idempotency key.                      |

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

## openEHR Submission Contract

Runtime clinical submissions must identify a published openEHR template and provide FLAT Web Template paths. The current bridge accepts these values under `note.payload.openEhr`:

- `templateId`: CDR template identifier to use for Composition validation.
- `compositionPrefix`: optional FLAT payload prefix; defaults to the template ID or `EHRBASE_DEFAULT_COMPOSITION_PREFIX`.
- `flat`: FLAT Web Template key/value payload.

The EHRbase bridge uses the official openEHR REST API:

- template upload/list/read: `/definition/template/adl1.4`
- Web Template retrieval: `/definition/template/adl1.4/{template_id}/webtemplate`
- FLAT Composition commit: `/ehr/{ehr_id}/composition?templateId=...&format=FLAT`
- AQL: `/query/aql`

The patient subject namespace must satisfy openEHR/EHRbase identifier rules. Use `vcms-patient` locally; avoid dotted values such as `vcms.patient`.

The service adds standard Composition context defaults when absent:

- `context/start_time`
- `category|code`
- `category|value`
- `category|terminology`

After EHRbase accepts the Composition, local note versions store only the openEHR reference and payload hashes. Clinical source data must be read from EHRbase by Composition UID/AQL, not from local workflow tables.

Local development has two seeded users after `npm run seed`:

- `admin@example.test / ChangeMe123!`
- `emr.tester@example.test / ChangeMe123!`

`npm run ehrbase:smoke` uploads the fixture OPT if needed, fetches its Web Template, creates a disposable EHR, submits one FLAT Composition, and verifies retrieval by AQL.

## openEHR Template Registry Contract

Template Registry endpoints are intentionally generic and must not depend on VCMS-specific field definitions. They sit between EHRbase templates/Web Templates and future EMR Builder/runtime form manifests.

`GET /api/v1/openehr/templates` accepts an optional `status` query parameter:

- `uploaded`
- `active`
- `retired`

`POST /api/v1/openehr/templates` accepts:

- `operationalTemplateXml`: ADL 1.4 OPT XML.

The route uploads the OPT to EHRbase, reads CDR template metadata, fetches the Web Template JSON, stores local hashes, and writes an audit record.

`POST /api/v1/openehr/templates/sync` accepts:

- `templateId`: CDR template identifier.

The route refreshes local metadata and cached Web Template JSON for a template already known to EHRbase.

`GET /api/v1/openehr/templates/manifest?templateId=...` returns a runtime manifest derived from the cached Web Template. The manifest includes:

- template identifiers and Web Template hash.
- section-like nodes such as Composition, Section, Entry, and Cluster.
- field nodes with generated FLAT paths.
- input suffixes such as `|code`, `|value`, and `|terminology`.
- required, repeating, and context markers.
- local option lists and terminology metadata when present in the Web Template.

All Template Registry endpoints require `emr.template.manage`. Read endpoints use the read rate-limit policy. Upload and sync use the mutation rate-limit policy and write audit records.

## Curated AQL Query Contract

The application must not expose arbitrary AQL execution through public API routes. AQL access is through named, curated query definitions only.

`GET /api/v1/openehr/aql/queries` returns registered query metadata without exposing raw AQL text. Current query IDs:

- `composition.list_by_ehr`
- `composition.list_by_template`
- `composition.get_by_uid`

`POST /api/v1/openehr/aql/queries/execute` accepts:

- `queryId`: registered curated query ID.
- `parameters`: object containing only the parameters declared by that query.
- `offset`: optional non-negative integer.
- `fetch`: optional positive integer capped by the query definition.

The service validates identifiers before calling EHRbase:

- `ehrId` must be an openEHR EHR UUID.
- `templateId` must match the local template identifier character policy.
- `compositionUid` must match the EHRbase/openEHR UID character policy.

All curated AQL routes require `emr.aql.query`. Execution uses the read rate-limit policy but writes an audit record because it reads clinical CDR data.

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
- missing openEHR template mapping
- missing FLAT Web Template payload
- CDR unavailable
- CDR EHR creation failed
- CDR Composition rejected

Each error response must include a request ID.
