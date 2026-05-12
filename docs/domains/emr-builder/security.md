---
title: EMR Builder Security Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-12
---

# EMR Builder Security Blueprint

## Security Baseline

Every Builder API route needs explicit authentication, validation, AuthZ, rate limiting, safe error handling, and structured request logging.

Every Builder mutation needs a named privilege in `src/lib/server/authz/privileges.toml`.

## Privilege-Sensitive Actions

Builder actions requiring audit logs include:

- definition draft create or update
- dictionary asset draft create or update
- field or section structural change
- validation rule change
- pathway graph change
- dictionary asset publish or retire
- publish
- retire
- rollback or supersede
- manual correction of definition metadata

Audit records must include actor, action, resource, request ID, timestamp, reason where applicable, and before/after metadata where available.

## Publication Boundary

Publishing a definition makes it available to runtime workflows. Publication must verify schema validity, pathway graph validity, branch target integrity, privilege coverage for sensitive actions, and compatibility with runtime consumers.

Published definitions must not be edited in place after runtime use.

## Rate Limits

Builder reads can use standard authenticated read limits. Draft mutation, publish, retire, rollback, and pathway graph updates should use stricter administrative mutation limits.

## Implemented Route Review

Reviewed on 2026-05-12 after the Builder API, reusable dictionary, renderer, Svelte Builder UI, and openEHR platform foundation work.

| Route                                     | Method | Privilege               | Rate limit | Validation                                     | Audit behavior                                                                              |
| ----------------------------------------- | ------ | ----------------------- | ---------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `/api/v1/emr-builder/draft`               | `GET`  | `emr.builder.manage`    | read       | `emrBuilderDefinitionQuerySchema` query parse  | failure audit from API wrapper                                                              |
| `/api/v1/emr-builder/draft`               | `POST` | `emr.builder.manage`    | mutation   | `emrBuilderSaveDraftSchema`                    | service transaction writes `save_draft` audit before commit; audit failure rejects mutation |
| `/api/v1/emr-builder/publish`             | `POST` | `emr.builder.manage`    | mutation   | `emrBuilderPublishDraftSchema`                 | service transaction writes publish audit before commit; audit failure rejects mutation      |
| `/api/v1/emr-builder/definition`          | `GET`  | `emr.builder.manage`    | read       | `emrBuilderDefinitionQuerySchema` query parse  | failure audit from API wrapper                                                              |
| `/api/v1/emr-builder/versions`            | `GET`  | `emr.builder.manage`    | read       | `emrBuilderDefinitionQuerySchema` query parse  | failure audit from API wrapper                                                              |
| `/api/v1/emr-builder/dictionary`          | `POST` | `emr.dictionary.manage` | mutation   | `emrDictionarySaveDraftSchema`                 | explicit dictionary save audit after service save                                           |
| `/api/v1/emr-builder/dictionary/list`     | `GET`  | `emr.dictionary.manage` | read       | `emrDictionaryListQuerySchema` query parse     | failure audit from API wrapper                                                              |
| `/api/v1/emr-builder/dictionary/item`     | `GET`  | `emr.dictionary.manage` | read       | `emrDictionaryAssetIdentitySchema` query parse | failure audit from API wrapper                                                              |
| `/api/v1/emr-builder/dictionary/versions` | `GET`  | `emr.dictionary.manage` | read       | `emrDictionaryAssetIdentitySchema` query parse | failure audit from API wrapper                                                              |
| `/api/v1/emr-builder/dictionary/publish`  | `POST` | `emr.dictionary.manage` | mutation   | `emrDictionaryPublishDraftSchema`              | explicit dictionary publish audit after service save                                        |
| `/api/v1/emr-builder/dictionary/retire`   | `POST` | `emr.dictionary.manage` | mutation   | `emrDictionaryRetireSchema`                    | explicit dictionary retire audit after service save                                         |

The route contract is pinned by `src/routes/api/v1/emr-builder/emr-builder.route-contract.spec.ts`.

## Current Security Notes

- Builder management remains an administrative privilege (`emr.builder.manage`) rather than a runtime clinician privilege.
- Save and publish routes audit metadata only: definition IDs, version numbers, hashes, and status. Full clinical definition payloads should not be copied into audit rows.
- Definition draft save and publish write their success audit inside the service-owned repository transaction. The route passes request context to the service and does not catch or downgrade success-audit failures; if durable audit write fails, the Builder mutation fails and the shared API wrapper records the rejected request path.
- Dictionary save, publish, and retire routes audit metadata only: dictionary ID, key, kind, version, hash, and status. Full reusable clinical payloads should not be copied into audit rows.
- Published definitions are immutable version records. Runtime and mobile consumers receive active published models through runtime mobile-definition routes, not Builder draft routes.
- Imported starter data can include labels, choice names, constraints, relevance logic, SNOMED CT metadata, and openEHR mappings. Importers and UI previews must treat those as clinical configuration data and keep them behind Builder privileges until published.
- EHRbase is the clinical data repository. VCMS must not duplicate clinical composition payloads into local audit logs or local workflow tables beyond identifiers, hashes, and operational status needed for traceability.
