---
title: Reusable openEHR EMR Platform Implementation Status
status: draft
owner: engineering
last_reviewed: 2026-05-12
plan_date: 2026-05-11
implementation_status: curated_aql_query_slice
portable: true
---

# Reusable openEHR EMR Platform Implementation Status

## Current State

The plan has been drafted from the openEHR architecture review and the current VCMS EMR Builder direction. The first reusable runtime EHRbase bridge slice is now implemented and live-smoke-tested locally. A first Template Registry API slice now exposes local template listing, OPT upload/sync, and Web Template-derived runtime manifests. A first admin UI slice now gives privileged Builder users a reusable openEHR Template Registry screen for OPT upload, CDR sync, registered template review, and runtime manifest inspection. A first curated AQL service slice now exposes governed Composition lookup queries without exposing arbitrary AQL.

EHRbase has been added to the local Docker Compose setup and brought up successfully. The local EHRbase API is reachable at:

```text
http://localhost:8080/ehrbase/rest/openehr/v1
```

The current VCMS EMR Builder is still a form-oriented editor and must evolve into a dictionary/template/runtime model. Runtime clinical submission now has a working CDR-owned Composition path and a reusable openEHR template registry/cache foundation that is intentionally not VCMS-specific.

## Implemented

- EHRbase Docker services added locally.
- EHRbase API verified with Basic Auth.
- Local EHRbase Swagger/OpenAPI verified. Current EHRbase exposes FLAT Composition submission through the official openEHR endpoint, not the older ECIS endpoint.
- EMR Builder has initial direct edit route and fixture-backed definitions.
- EMR Builder has a first-pass field/property editor.
- Initial dictionary concept exists in planning.
- openEHR architecture standard added as portable documentation.
- Initial SNOMED CT terminology API and EMR Builder field picker added with a development mock provider.
- EHRbase server client added for EHR creation, ADL 1.4 template list/upload, Web Template fetch, FLAT Composition submission, and AQL execution.
- Patient rows now carry linked `ehr_id` and subject identity metadata.
- Clinical note versions now store openEHR Composition references and payload hashes rather than the local clinical payload body.
- PEC OPD runtime submission now calls the EHRbase composition bridge before writing the local operational note version.
- Generic `openehr_templates` registry added for CDR template metadata, hashes, status, archetype IDs, and Web Template root IDs.
- Generic `openehr_web_template_caches` table added for cached Web Template JSON and hash.
- `OpenEhrTemplateService` added to upload/sync ADL 1.4 templates and cache Web Templates through EHRbase.
- Template Registry API added:
  - `GET /api/v1/openehr/templates`
  - `POST /api/v1/openehr/templates`
  - `POST /api/v1/openehr/templates/sync`
  - `GET /api/v1/openehr/templates/manifest`
- Runtime manifest generation added from cached Web Template JSON, including section nodes, field nodes, FLAT paths, input suffixes, repeating markers, required markers, context fields, terminology hints, and option lists.
- New `emr.template.manage` privilege added for template registry management.
- Template Registry admin UI added under `/emr-builder/openehr`.
- EMR Builder left navigation now links to openEHR Templates.
- Template Registry admin UI supports:
  - ADL 1.4 OPT XML upload.
  - sync from an existing CDR template ID.
  - local template registry table review.
  - Web Template runtime manifest inspection with sections, fields, required count, repeating count, FLAT base paths, input suffix paths, and option counts.
- Curated AQL query service added with named server-side query definitions:
  - `composition.list_by_ehr`
  - `composition.list_by_template`
  - `composition.get_by_uid`
- Curated AQL API added:
  - `GET /api/v1/openehr/aql/queries`
  - `POST /api/v1/openehr/aql/queries/execute`
- New `emr.aql.query` privilege added for governed clinical CDR query execution.
- Local seed now creates two password-backed users:
  - `admin@example.test / ChangeMe123!`
  - `emr.tester@example.test / ChangeMe123!`
- Local openEHR fixture set added under `fixtures/openehr/`.
- `npm run ehrbase:smoke` added and verified against the running EHRbase container.
- Default openEHR subject namespace corrected to `vcms-patient`; dotted namespace values such as `vcms.patient` fail EHRbase/openEHR validation.

## Partially Implemented

- EHRbase bridge service: client surface now covers template list/upload, Web Template fetch, EHR creation, FLAT Composition submission, and AQL execution.
- Patient-to-`ehr_id` linkage: stored on `patients`; dedicated link table remains future work.
- Composition submission service: validates template/payload presence and stores local references.
- Runtime form submission to EHRbase: wired for PEC OPD clinical note submission.
- Data Dictionary persistence model: field/option-set/fragment assets exist; deeper openEHR archetype/template binding workflow remains future work.
- Template registry: persistence, service foundation, management API, runtime manifest API, and initial admin UI implemented; full governance workflow remains future work.
- AQL query service: low-level client method plus first curated query registry/API implemented.

## Not Started

- Template publication workflow.
- Instruction/Action workflow implementation.
- Consent and data-level access policy.
- Production SNOMED CT terminology provider integration.
- Migration/conversion pipeline.

## Next Milestone

Build the next reusable platform slice on top of the proven EHRbase bridge:

```text
uploaded OPT / external template
  -> CDR template metadata
  -> Web Template cache
  -> dictionary/template binding
  -> runtime form manifest API
  -> Composition submit
  -> curated AQL query
  -> reusable non-VCMS package boundary
```

The first smoke-tested vertical slice is complete:

```text
fixture OPT
  -> EHRbase template available
  -> Web Template fetched
  -> disposable EHR created
  -> FLAT Composition submitted
  -> AQL query returned one Composition row
```

## Planning Coverage Added

The current plan now covers these implementation and policy areas:

- five-tier deployment architecture.
- CDR/application/browser boundary contracts.
- patient identity and `ehr_id` linkage.
- reusable Data Dictionary model.
- archetype/template/Web Template lifecycle.
- runtime draft and Composition submission lifecycle.
- openEHR Entry classes and clinical categories.
- Instruction/Action intervention workflow.
- versioning, Contributions, corrections, voiding, and attestations.
- AQL query and reporting model.
- path, locator, and `DV_EHR_URI` handling.
- terminology bindings and UCUM unit policy.
- SNOMED CT browser and terminology service architecture, including CSNOFinder/CSNOtk, Snowstorm, Snowstorm Lite, provider abstraction, licensing, binding metadata, and failure policy.
- consent, purpose-of-use, care relationship, break-glass, export, and audit policy.
- migration from XLS/ODK/CSV/legacy sources through source mappings.
- operations: configuration, backup/restore, CDR upgrade, monitoring, and deployment readiness.
- portability requirements for non-VCMS deployments.
- modelling toolchain role for Archetype Companion as a discovery/planning aid, not authoritative runtime source.

## Implementation Readiness Matrix

| Area                          | Plan State | Implementation State       |
| ----------------------------- | ---------- | -------------------------- |
| EHRbase local runtime         | documented | partially implemented      |
| EHRbase bridge service        | detailed   | reusable slice implemented |
| Patient-EHR linkage           | detailed   | partial on patient row     |
| Data Dictionary               | detailed   | persistence started        |
| Template registry             | detailed   | API/service slice done     |
| Runtime form engine           | detailed   | manifest API started       |
| Composition submission        | detailed   | first slice implemented    |
| AQL query service             | detailed   | low-level client only      |
| SNOMED CT terminology service | detailed   | partial mock/API/picker    |
| Instruction/Action workflow   | detailed   | not started                |
| Consent/access policy         | detailed   | not started                |
| Migration pipeline            | detailed   | not started                |
| Portability adapters          | detailed   | not started                |

## Open Decisions

- Which openEHR authoring tool will be used first for OPT/template creation.
- Whether Archetype Companion project/checklists should be exported and stored as formal modelling evidence.
- Whether to support STRUCTURED payloads after the initial FLAT payload bridge.
- Whether to add a Java/Kotlin helper for template processing, or rely entirely on EHRbase Web Template APIs. Current slice proves EHRbase Web Template retrieval is enough for the first runtime bridge.
- Whether runtime manifests should be versioned separately from cached Web Templates or derived on demand as implemented now.
- Initial ophthalmology archetype/template selection.
- Initial terminology source for SNOMED CT/LOINC lookup.
- Whether CSNOFinder is used as the initial human browser, and whether CSNOServ, Snowstorm, or Snowstorm Lite backs the application terminology API.
- Which SNOMED CT edition, national extension, language refset, release version, and RF2 update process will be used.
- Minimum viable consent model for the first runtime release.

## Known Constraints

- EHRbase is headless; the application must provide clinical UI and admin workflows.
- Web Template JSON should be the Svelte/application bridge.
- Raw CDR credentials must remain server-side.
- Existing XLS/ODK forms are guidance and migration source material, not the future clinical model.
- Published clinical definitions and submitted clinical data must be immutable by version.
- Runtime Composition submission must use the official EHRbase openEHR endpoint:
  `/ehr/{ehr_id}/composition?templateId=...&format=FLAT`.
- Local operational tables may store identifiers, hashes, and workflow status, but must not become the longitudinal clinical Composition store.

## Current Verification

Verified after the reusable bridge update:

- focused template registry tests:
  - `npm run test:unit -- --run src/lib/server/modules/ehrbase/open-ehr-template.service.spec.ts src/routes/api/v1/openehr-template.route-contract.spec.ts src/lib/server/authz/privilege-registry.spec.ts`
- `npm run seed`
- `npm run db:push`
- `npm run ehrbase:smoke`
- `npm run check`
- `npm run test:unit -- --run`
- `npm run build`
- targeted Prettier check on changed TS/JSON/Markdown files
- `git diff --check`

Latest live smoke result:

```text
templateId: IDCR Medication List.v0
webTemplateRoot: current_medication_list
compositionUid: b110891c-eec9-42a9-8042-617c0001744e::vcms.local.ehrbase::1
queryRows: 1
```
