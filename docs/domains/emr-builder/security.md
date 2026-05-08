---
title: EMR Builder Security Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-09
---

# EMR Builder Security Blueprint

## Security Baseline

Every Builder API route needs explicit authentication, validation, AuthZ, rate limiting, safe error handling, and structured request logging.

Every Builder mutation needs a named privilege in `src/lib/server/authz/privileges.toml`.

## Privilege-Sensitive Actions

Builder actions requiring audit logs include:

- definition draft create or update
- field or section structural change
- validation rule change
- pathway graph change
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

Reviewed on 2026-05-09 after the Builder API, XLSForm parity model, renderer, and Svelte Builder UI work.

| Route                            | Method | Privilege            | Rate limit | Validation                                    | Audit behavior                                 |
| -------------------------------- | ------ | -------------------- | ---------- | --------------------------------------------- | ---------------------------------------------- |
| `/api/v1/emr-builder/draft`      | `GET`  | `emr.builder.manage` | read       | `emrBuilderDefinitionQuerySchema` query parse | failure audit from API wrapper                 |
| `/api/v1/emr-builder/draft`      | `POST` | `emr.builder.manage` | mutation   | `emrBuilderSaveDraftSchema`                   | explicit `save_draft` audit after service save |
| `/api/v1/emr-builder/publish`    | `POST` | `emr.builder.manage` | mutation   | `emrBuilderPublishDraftSchema`                | explicit publish audit after service publish   |
| `/api/v1/emr-builder/definition` | `GET`  | `emr.builder.manage` | read       | `emrBuilderDefinitionQuerySchema` query parse | failure audit from API wrapper                 |
| `/api/v1/emr-builder/versions`   | `GET`  | `emr.builder.manage` | read       | `emrBuilderDefinitionQuerySchema` query parse | failure audit from API wrapper                 |

The route contract is pinned by `src/routes/api/v1/emr-builder/emr-builder.route-contract.spec.ts`.

## Current Security Notes

- Builder management remains an administrative privilege (`emr.builder.manage`) rather than a runtime clinician privilege.
- Save and publish routes audit metadata only: definition IDs, version numbers, hashes, and status. Full clinical definition payloads should not be copied into audit rows.
- Published definitions are immutable version records. Runtime and mobile consumers receive active published models through runtime mobile-definition routes, not Builder draft routes.
- XLSForm import parity data can include labels, choice names, constraints, relevance logic, and SNOMED metadata. Importers and UI previews must treat those as clinical configuration data and keep them behind Builder privileges until published.
