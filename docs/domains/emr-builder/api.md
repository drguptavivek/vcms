---
title: EMR Builder API Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-09
---

# EMR Builder API Blueprint

## Planned Route Area

Prefer `/api/v1/emr-builder/**` for Builder administration endpoints.

Implemented endpoint families:

- `draft`: create/update and fetch the editable draft payload for a definition.
- `publish`: publish a draft as an immutable version.
- `definition`: fetch definition metadata.
- `versions`: inspect published versions.

Planned endpoint families that are not implemented yet:

- `sections`: manage reusable clinical sections outside a single definition payload.
- `fields`: manage field libraries, labels, validation, and display metadata outside a single definition payload.
- `pathways`: manage graphical pathway nodes and branch conditions outside the draft JSON editor.
- `retire` / `rollback`: retire or supersede published definitions through explicit administrative actions.

## Implemented Routes

| Route                                             | Method | Purpose                                                 |
| ------------------------------------------------- | ------ | ------------------------------------------------------- |
| `/api/v1/emr-builder/draft?definitionId=...`      | `GET`  | Fetch definition metadata and current draft payload.    |
| `/api/v1/emr-builder/draft`                       | `POST` | Validate and save a definition draft.                   |
| `/api/v1/emr-builder/publish`                     | `POST` | Publish the latest draft as the next immutable version. |
| `/api/v1/emr-builder/definition?definitionId=...` | `GET`  | Fetch definition metadata.                              |
| `/api/v1/emr-builder/versions?definitionId=...`   | `GET`  | List published versions.                                |

All implemented Builder routes require `emr.builder.manage`. Route contract coverage lives in `src/routes/api/v1/emr-builder/emr-builder.route-contract.spec.ts`.

## Transport Rules

Routes transport data only. Business rules belong in `emr-builder.service.ts`, validation belongs in shared Zod schemas, and persistence belongs in `emr-builder.repository.ts`.

Every Builder route must use shared API helpers, request ID propagation, Zod validation, AuthZ, rate limiting, safe error responses, and structured logging.

## Definition Payload Contract

The draft payload is the versioned `EmrNoteDefinition` JSON model. The Builder schema is the source of truth:

- `fieldName` for runtime/data field names.
- `logic` for relevance, required expressions, calculations, triggers, constraints, choice filters, and choice randomization.
- `input` for barcode input, text masks, text case transforms, range settings, GPS capture settings, image limits, and audit-location settings.
- `validation` for required messages, text length limits, numeric bounds, and patterns.
- section-level `odk` metadata for group/repeat behavior.
- field-level SNOMED CT metadata, including numeric concept IDs.
- external choice source references for master data, terminology, clinical worklists, and future API-backed lists.

Legacy/import metadata such as `xlsv1Name` and `odkBind` can be retained for provenance and compatibility, but new runtime behavior should read the Builder fields first.

The server validates this payload with Zod before saving or publishing. Runtime/mobile consumers should use published render models, not draft payloads.

## Stable Error Expectations

Builder APIs must never expose raw SQL errors. Expected safe errors include:

- invalid definition
- conflicting draft version
- published version cannot be edited
- definition in use cannot be deleted
- pathway graph has invalid branch target
- missing required validation rule
- unauthorized publish attempt
- validation failure
- rate limit exceeded
- unpublished definition requested through runtime/mobile sync
- published version payload fails definition validation

Each error response must include a request ID.
