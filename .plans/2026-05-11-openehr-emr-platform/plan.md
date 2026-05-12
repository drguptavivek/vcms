---
title: Reusable openEHR EMR Platform Implementation Plan
status: draft
owner: engineering
last_reviewed: 2026-05-11
plan_date: 2026-05-11
implementation_status: planning
portable: true
---

# Reusable openEHR EMR Platform Implementation Plan

## Summary

Build a dedicated EMR implementation around openEHR recommendations, using an existing openEHR CDR such as EHRbase as the clinical source of truth. The deliverable should be reusable outside VCMS: VCMS becomes one deployment of a broader architecture, not the architecture itself.

The core platform is a clinical modelling, runtime form, Composition submission, workflow, query, and migration system built around:

- Archetypes.
- Templates.
- Web Templates.
- Compositions.
- Contributions.
- AQL.
- terminology bindings.
- consent-aware access control.

## Primary Goals

1. Define a reusable openEHR-first architecture suitable for VCMS and non-VCMS EMR deployments.
2. Build a Data Dictionary that stores reusable Elements, Clusters, Entries, Fragments, Option Sets, and Composition templates.
3. Treat forms as presentations of Composition templates, not as the source clinical model.
4. Use EHRbase for clinical Composition storage, validation, versioning, and AQL.
5. Keep demographics, patient search, local operations, AuthZ, consent, drafts, and UI state in the application layer.
6. Support legacy/XLS/ODK import only as source mapping and seeding, not as the permanent model.
7. Make the implementation auditable, versioned, and queryable by design.

## Core Architecture Decision

Use this boundary:

```text
Application platform
  owns:
    UI
    local patient identity
    demographics
    drafts
    data dictionary
    template lifecycle
    form rendering
    consent and purpose checks
    workflow queues
    migration source mappings
    local audit/reporting

openEHR CDR
  owns:
    EHRs
    Compositions
    versioned Composition history
    Contributions
    openEHR validation
    AQL query execution
```

## Reusable Product Shape

The implementation should be packaged conceptually as an openEHR EMR platform with adapters:

```text
Core openEHR EMR platform
  data dictionary
  template registry
  runtime forms
  Composition mapper
  AQL query service
  identity bridge
  consent/access service
  integration pipeline

Deployment adapter
  VCMS adapter
  non-VCMS clinic adapter
  mobile collection adapter
  reporting adapter
```

The core model should avoid names such as VCMS, PEC, OPD, or XLSForm except in deployment-specific adapters and source mappings.

## Phase 0: Foundation And Governance

### Decisions

- Use EHRbase as the first CDR.
- Use Web Templates as the frontend/runtime bridge.
- Use AQL for clinical query.
- Use local PostgreSQL for demographics, dictionary, drafts, mappings, audit, and operational workflows.
- Keep browser access behind application APIs.

### Deliverables

- Portable architecture standard: `docs/standards/openehr-emr-implementation.md`.
- Project-specific adoption plan.
- glossary of openEHR terms and local equivalents.
- initial domain model for dictionary/template/runtime/query/identity/consent modules.
- modelling toolchain policy covering Archetype Companion, CKM/source repositories, authoring tools, and CDR runtime artefacts.

### Acceptance Criteria

- Engineers can explain the difference between patient ID, `ehr_id`, Composition UID, Version UID, path, and `DV_EHR_URI`.
- Engineers can explain the difference between field input type and clinical Entry class.
- There is a written rule that submitted clinical records are CDR Compositions, not local mutable rows.
- Archetype Companion is classified as a discovery/planning tool, not the authoritative source of runtime templates.

## Phase 1: EHRbase Runtime Connectivity

### Scope

Create a reliable CDR bridge service that can create EHRs, upload/fetch templates, fetch Web Templates, submit Compositions, and run AQL.

### Logical Modules

```text
ehr-bridge
  cdr-client
  ehr-identity
  template-client
  web-template-cache
  composition-client
  aql-client
  cdr-error-mapper
```

### Capabilities

- create EHR.
- find EHR by subject ID/namespace.
- link local patient to `ehr_id`.
- upload OPT/template.
- fetch template metadata.
- fetch Web Template JSON.
- submit Composition in flat or structured format.
- read latest and exact Composition versions.
- execute AQL with safe parameterization.
- map CDR failures to stable application errors.

### Persistence

```text
ehr_patient_links
  patient_id
  ehr_id
  subject_id
  subject_namespace
  status
  verified_at
  verified_by

ehr_templates
  template_id
  template_version
  cdr_template_id
  lifecycle_state
  uploaded_at
  uploaded_by
  web_template_hash

ehr_submissions
  local_submission_id
  patient_id
  ehr_id
  template_id
  composition_uid
  version_uid
  contribution_uid
  change_type
  change_reason
  committed_at
  committed_by
```

### Acceptance Criteria

- A test patient can be linked to a real `ehr_id`.
- A template can be uploaded and a Web Template can be cached.
- A valid Composition can be committed to EHRbase.
- An invalid Composition is rejected by EHRbase and remains unsubmitted locally.
- AQL can query the committed Composition.

## Phase 2: Portable Data Dictionary

### Scope

Build a reusable dictionary of clinical and operational building blocks.

### Dictionary Object Types

- Element.
- Cluster.
- Option Set.
- Observation.
- Evaluation.
- Instruction.
- Action.
- Admin Entry.
- Section.
- Fragment.
- Composition Template.

### Required Metadata

Each object supports:

```text
identity
  dictionary_id
  version
  status
  source
  owner

clinical_semantics
  entry_class
  clinical_category
  clinical_concept
  laterality
  body_site
  time_semantics

input_metadata
  widget_type
  field_name
  label
  help_text
  required
  read_only
  hidden
  validation
  mask
  text_case
  barcode_allowed

open_ehr_mapping
  rm_type
  dv_type
  archetype_id
  archetype_node_id
  archetype_root
  template_id
  web_template_path
  aql_path

terminology
  local_codes
  snomed_ct
  loinc
  icd10
  ucum

privacy_access
  privacy_class
  purpose_allowed
  access_requirements
  break_glass_allowed
  deidentify_before_export
```

### Acceptance Criteria

- A reusable IOP Element can express input metadata, unit, laterality, Entry class, terminology binding, and openEHR path.
- A reusable cataract diagnosis Option Set can map local choices to external terminology codes.
- A reusable cataract referral Fragment can represent an Instruction workflow, allowed states, and fulfilling Action.
- Published dictionary versions cannot be modified in place.

## Phase 3: Template Registry And Publication

### Scope

Build lifecycle management for templates and runtime forms.

### Lifecycle

```text
draft
locally_validated
template_uploaded
web_template_cached
ehrbase_validation_ready
published
retired
```

### Capabilities

- create local Composition template definition.
- assemble Sections, Entries, Clusters, Elements, Option Sets, and Fragments.
- link to external archetypes/templates.
- upload template to CDR.
- fetch and cache Web Template.
- validate local form metadata against Web Template paths.
- publish immutable template versions.
- retire older template versions without breaking historic data.

### Acceptance Criteria

- A published form references immutable dictionary snapshots.
- A published form has a template ID, template version, Web Template hash, and CDR upload status.
- Old submitted records remain interpretable after the form/template changes.

## Phase 4: Runtime Form Engine

### Scope

Render published Composition templates as usable clinical forms.

### Runtime Flow

```text
open form
  -> resolve patient/ehr_id
  -> load published form definition
  -> load Web Template
  -> create draft state
  -> validate user input locally
  -> submit through server service
  -> map to Composition payload
  -> commit to EHRbase
  -> store submission references
```

### Runtime Requirements

- support field widgets: text, integer, decimal, range, date, time, dateTime, select one, select many, note, calculate, barcode, image, audio/video/file where required.
- support barcode input for text fields where configured.
- support max text width.
- support text case rules.
- support input masks such as `##-##-######`.
- support section relevance/skip logic.
- support repeats.
- support multilingual labels/hints/messages.
- support validation: required, required message, constraint, min, max, length, pattern, entry mask, custom messages.
- support privacy-aware hiding/filtering.
- support save draft versus submit.

### Acceptance Criteria

- A form can be rendered without hard-coded Svelte fields.
- A draft can be saved without CDR commit.
- A submission creates a real EHRbase Composition.
- A correction creates a new version and requires a reason.
- Users without access cannot view restricted fields even if the Composition contains them.

## Phase 5: Clinical Workflow And Interventions

### Scope

Implement Instruction/Action workflows for interventions such as referrals, surgery, spectacles, investigations, and follow-up plans.

### Model

```text
Instruction
  request/order/plan/referral

Action
  performed/completed/aborted intervention
```

### State Machine

```text
initial
planned
postponed
scheduled
active
suspended
completed
cancelled
aborted
expired
```

### Capabilities

- create intervention request.
- schedule intervention.
- postpone/resume/cancel/abort.
- complete with linked Action.
- query active, scheduled, overdue, cancelled, completed interventions.
- link Action back to Instruction through `DV_EHR_URI` or equivalent CDR locator.

### Acceptance Criteria

- Cataract referral is modelled as an Instruction, not a yes/no field.
- Cataract surgery completion is modelled as an Action linked to the referral.
- Active referral lists are queryable.
- Surgery completion can update the referral state in the same logical Contribution when supported.

## Phase 6: Query, Reports, And Patient Chart

### Scope

Build query and chart views over committed openEHR data.

### Capabilities

- curated AQL query service.
- saved query definitions.
- dictionary-driven query builder.
- patient timeline.
- Composition history viewer.
- latest clinical summary.
- condition/intervention worklists.
- report export with privacy and deidentification rules.

### Query Metadata

Dictionary items must provide:

```text
aql_archetype_id
aql_select_path
aql_filter_path
result_alias
value_type
unit
terminology_binding
time_filter_support
aggregation_support
```

### Acceptance Criteria

- User can query all patients with cataract diagnosis.
- User can query IOP above a threshold.
- User can query referred-but-not-operated patients.
- User can inspect the exact Composition/version behind a query result.

## Phase 7: Security, Consent, And Audit

### Scope

Implement data-level access policy in addition to route-level authorization.

### Capabilities

- purpose-of-use selection.
- consent profile per patient.
- care relationship check.
- site role/privilege check.
- data sensitivity filtering.
- break-glass access with reason.
- audit review screens.
- export/deidentification controls.

### Acceptance Criteria

- Access is evaluated by patient, user, site, purpose, consent, relationship, and data sensitivity.
- Break-glass access is audited and reviewable.
- Research exports exclude or deidentify restricted fields unless consent permits use.
- UI and API return consistent access-filtered results.

## Phase 8: Integration And Migration

### Scope

Import existing XLS, ODK, CSV, HL7, or legacy records without letting legacy fields become the target model.

### Pipeline

```text
source file/message/row
  -> source-shaped staging record
  -> mapping review
  -> target dictionary item
  -> Composition payload
  -> CDR submit
  -> conversion result
```

### Capabilities

- source dataset registry.
- source field inventory.
- mapping confidence/review workflow.
- value transforms.
- unit transforms.
- code transforms.
- error review.
- source provenance.
- rerunnable conversion jobs.

### Acceptance Criteria

- Legacy `IOP_RE` maps to a dictionary IOP right-eye Element, not a permanent field identity.
- Legacy referral fields map to Instruction workflow fragments.
- Failed conversions produce reviewable errors.
- Every migrated Composition retains source provenance.

## Phase 9: Portability And Packaging

### Scope

Make the implementation reusable outside VCMS.

### Portable Assets

- openEHR implementation standard.
- dictionary schema.
- template lifecycle schema.
- runtime form schema.
- CDR bridge interfaces.
- terminology mapping schema.
- privacy/access policy model.
- migration mapping schema.
- example ophthalmology dictionary pack.
- example general outpatient dictionary pack.

### Deployment Adapters

VCMS adapter:

- PEC/camp metadata.
- barcode workflow.
- ophthalmology forms.
- local staff/site model.

Generic clinic adapter:

- generic registration.
- generic encounter.
- generic problem/diagnosis/observation/procedure workflow.

### Acceptance Criteria

- A non-VCMS application can reuse the dictionary/template/runtime model without PEC-specific concepts.
- VCMS-specific concepts live in adapters or source mappings.
- Documentation explains how to deploy with EHRbase and an application database.

## Phase 10: Testing And Safety Gates

### Test Categories

- dictionary validation tests.
- template publication tests.
- CDR bridge integration tests.
- Composition submit/reject tests.
- AQL query tests.
- versioning/correction tests.
- Instruction/Action workflow tests.
- access/consent tests.
- migration conversion tests.
- UI rendering tests.

### Safety Gates

Before publishing a form:

- dictionary snapshots resolved.
- template uploaded to CDR.
- Web Template cached.
- paths validated.
- required terminology/unit bindings reviewed.
- access policy reviewed.
- test Composition accepted by CDR.
- query mapping smoke tested.

Before committing clinical data:

- patient linked to correct `ehr_id`.
- user has access for purpose.
- consent permits use or break-glass is invoked.
- payload passes server validation.
- CDR accepts Composition.
- local submission reference stored.

## Initial VCMS Adoption Sequence

1. Stabilize EHRbase Docker and environment configuration.
2. Add EHRbase server module/client.
3. Add patient-to-`ehr_id` linkage table and service.
4. Add template/Web Template cache model.
5. Convert current EMR Builder schema toward dictionary + Composition template model.
6. Keep XLS/ODK artifacts as source mappings only.
7. Add runtime form submission to EHRbase for one simple test template.
8. Add AQL query service for committed test data.
9. Add privacy/access metadata to dictionary items.
10. Add Instruction/Action referral model for cataract referral and surgery completion.

## Risks

- Template/archetype authoring tools may not fit the initial ophthalmology workflow exactly.
- Some openEHR archetypes may need local specialization.
- EHRbase flat/structured payload expectations may require adapter work.
- Coded terminology mapping can be slow and clinically sensitive.
- Patient identity matching errors can create major safety/privacy incidents.
- Fine-grained access control can become unusable if over-designed.
- Browser form rendering can drift from Web Template validation unless path checks are strict.

## Rejected Approaches

- Build a custom CDR.
- Use XLS/ODK as permanent schema.
- Let the browser call EHRbase directly.
- Model referrals as simple yes/no fields.
- Store submitted clinical truth only in local relational tables.
- Treat role-based access alone as sufficient.
- Edit submitted Compositions in place.

## Detailed Workstreams

The phases above describe sequence. The workstreams below describe the permanent ownership areas that must be built and maintained.

### Workstream A: Clinical Modelling Governance

Purpose:

- decide which archetypes, templates, and local specialisations are used.
- control dictionary publication.
- prevent accidental schema drift.

Deliverables:

- clinical modelling board or named reviewer group.
- dictionary authoring policy.
- template authoring policy.
- archetype selection log.
- local specialisation register.
- modelling decision records.
- modelling toolchain register.

Implementation tasks:

1. Create a clinical concept inventory from current workflows.
2. Create an Archetype Companion project/checklist for candidate discovery where useful.
3. Classify each concept as Observation, Evaluation, Instruction, Action, Admin Entry, or operational-only.
4. Map concepts to known archetypes where possible.
5. Confirm selected archetypes from authoritative sources such as CKM or local governed repositories.
6. Mark unmapped concepts as local model candidates.
7. Define terminology bindings and UCUM units.
8. Review privacy class and purpose-of-use policy.
9. Publish dictionary versions.

Acceptance:

- no runtime form uses an unpublished dictionary item.
- every published clinical item has Entry class, datatype, privacy class, and owner.
- every reportable item has query mapping or documented reason for no query mapping.
- each archetype choice records whether it came from Archetype Companion planning, CKM/source repository import, or local specialisation review.

### Workstream B: EHRbase/CDR Bridge

Purpose:

- isolate the application from raw EHRbase API details.
- provide a stable CDR abstraction that could later support another openEHR CDR.

Deliverables:

- CDR client.
- CDR schemas.
- CDR error mapper.
- template upload/fetch service.
- Web Template cache.
- Composition submit/update service.
- AQL query service.
- integration tests against local EHRbase.

Implementation tasks:

1. Add server-only CDR config.
2. Add typed HTTP client with timeout/retry.
3. Add create/find EHR methods.
4. Add template upload and list/read methods.
5. Add Web Template retrieval and cache validation.
6. Add Composition submit in the chosen initial format.
7. Add Composition update/correction with version precondition.
8. Add AQL execution with named parameters where supported.
9. Add safe error normalization.
10. Add structured logs and metrics.

Acceptance:

- CDR credentials are never client-visible.
- failed CDR calls return stable safe errors.
- CDR integration tests can be run locally.
- one test Composition can be committed and queried.

### Workstream C: Patient Identity And EHR Linking

Purpose:

- guarantee safe linkage between local patient records and openEHR EHRs.
- prevent duplicate or wrong-patient clinical storage.

Deliverables:

- patient identity service.
- `patient_ehr_links` persistence.
- duplicate detection rules.
- merge/review workflow.
- patient identity audit events.

Implementation tasks:

1. Define local patient identity fields and identifier types.
2. Define subject namespace and subject ID format.
3. Implement EHR creation/linking.
4. Implement find-by-subject behavior.
5. Add duplicate link detection.
6. Add identity verification metadata.
7. Add merge/duplicate review workflow.
8. Block clinical submission when link is missing or conflicted.

Acceptance:

- each clinical submit has a verified `ehr_id`.
- duplicate active EHR links are blocked or explicitly governed.
- patient merge does not erase clinical submission references.

### Workstream D: Portable Data Dictionary

Purpose:

- make clinical objects reusable across forms, sites, and non-VCMS deployments.

Deliverables:

- dictionary schema.
- dictionary APIs.
- dictionary UI.
- option set editor.
- terminology binding editor.
- SNOMED CT concept picker integration.
- value-set/refset binding editor.
- privacy/access metadata editor.
- version diff view.

Implementation tasks:

1. Create dictionary item persistence.
2. Add object types: Element, Cluster, Entry, Fragment, Section, Option Set, Composition Template.
3. Add input metadata.
4. Add clinical semantics metadata.
5. Add openEHR mapping metadata.
6. Add terminology bindings.
7. Add SNOMED CT concept search, code lookup, and binding review through the application terminology API.
8. Add value-set support from explicit option lists, SNOMED CT refsets, ECL expressions, or locally curated option sets.
9. Add privacy/access metadata.
10. Add validation rules.
11. Add publish/retire workflow.
12. Add search/filter by concept, Entry class, terminology, status, owner, and binding status.

Acceptance:

- dictionary items are independently versioned.
- published item versions cannot be edited.
- option set values have stable local values.
- terminology binding changes require a new version or reviewed amendment.
- SNOMED CT bindings store edition, version, concept ID, preferred term, fully specified name, binding strength, reviewer, and review time.
- runtime forms do not depend on a public terminology browser being available.

### Workstream E: Template And Runtime Form Registry

Purpose:

- turn reusable dictionary objects and Web Templates into runtime-ready forms.

Deliverables:

- template registry.
- runtime form metadata model.
- publication workflow.
- Web Template path validator.
- form preview.
- form diff.
- retirement workflow.

Implementation tasks:

1. Define form/Composition template model.
2. Support Section -> Entry -> Structure -> Element hierarchy.
3. Link dictionary snapshots into templates.
4. Upload or associate openEHR template.
5. Fetch and cache Web Template.
6. Validate local fields against Web Template paths.
7. Add test payload generation.
8. Add publication checklist.
9. Add published form runtime manifest.
10. Add retired version handling.

Acceptance:

- runtime can load only published forms.
- historic submissions can resolve their form/template versions.
- Web Template mismatch blocks publication.

### Workstream F: Runtime Form Execution

Purpose:

- allow clinicians/users to collect data from published openEHR-backed forms.

Deliverables:

- runtime form renderer.
- draft save.
- server-side draft validation.
- Composition payload mapper.
- submit/correct/void workflows.
- runtime validation messages.

Implementation tasks:

1. Create runtime draft model.
2. Render controls from field/widget metadata.
3. Support sections, repeats, visibility rules, and grouped fragments.
4. Support text masks, barcode entry, max text width, text case, and choice controls.
5. Support multilingual labels/hints/messages.
6. Support required, constraint, pattern, min, max, length, and custom messages.
7. Build Composition payload mapper from Web Template paths.
8. Submit payload to CDR.
9. Store local submission references.
10. Display committed version and audit metadata.

Acceptance:

- drafts are mutable.
- submitted records are CDR-backed.
- correction requires reason and creates a new version.
- CDR rejection leaves draft unsubmitted.

### Workstream G: Intervention Workflow

Purpose:

- model real care processes with Instruction/Action rather than simple status fields.

Deliverables:

- intervention fragment type.
- state machine support.
- worklist views.
- Instruction/Action link metadata.
- workflow AQL/query definitions.

Implementation tasks:

1. Define intervention state table.
2. Define allowed transitions.
3. Model referral as Instruction.
4. Model performed procedure as Action.
5. Link Action to Instruction using exact locators.
6. Add worklists for planned, scheduled, active, completed, cancelled, and overdue interventions.
7. Add transition audit.
8. Add query/report definitions.

Acceptance:

- referred-but-not-completed patients can be queried.
- completed actions retain link to the originating instruction.
- cancellations and aborts require reason.

### Workstream H: Consent, Access, And Audit

Purpose:

- enforce realistic clinical access control without making the UI unusable.

Deliverables:

- consent profile model.
- purpose-of-use model.
- care relationship model.
- data-level policy engine.
- break-glass workflow.
- access decision logs.
- audit review UI.

Implementation tasks:

1. Define privacy classes.
2. Define purposes of use.
3. Define care relationship types.
4. Add policy evaluation service.
5. Enforce policy before CDR read results are displayed.
6. Enforce policy before export.
7. Add break-glass with reason and time limit.
8. Add review queue for break-glass events.
9. Add deidentification rules for research exports.
10. Add audit search/review screens.

Acceptance:

- access is denied when consent or purpose does not permit it.
- break-glass access is explicit and reviewable.
- restricted fields are filtered consistently in UI, API, exports, and query results.

### Workstream I: Query, Reporting, And Charting

Purpose:

- expose useful longitudinal clinical data without leaking raw AQL complexity.

Deliverables:

- saved queries.
- dictionary-driven query builder.
- patient timeline.
- Composition/version viewer.
- query result lineage.
- report export controls.

Implementation tasks:

1. Add AQL metadata to dictionary items.
2. Build saved query model.
3. Build query parameter model.
4. Add CDR query execution through access service.
5. Add result mapping.
6. Add lineage from result to EHR/composition/version/path.
7. Add patient timeline grouped by Composition and clinical category.
8. Add exports with deidentification.
9. Add report audit.

Acceptance:

- reports use dictionary/query mappings.
- results can be traced back to exact Composition/version where possible.
- raw AQL is restricted to privileged users.

### Workstream J: Integration And Migration

Purpose:

- safely migrate legacy/source data into designed openEHR structures.

Deliverables:

- source dataset registry.
- source field inventory.
- source mapping editor.
- conversion jobs.
- validation error review.
- migration audit.
- provenance model.

Implementation tasks:

1. Register source datasets with checksums.
2. Inventory source fields.
3. Map source fields to dictionary items.
4. Define transforms for values, units, options, dates, and laterality.
5. Review mappings with confidence status.
6. Run dry-run conversion.
7. Review CDR validation failures.
8. Commit accepted conversions.
9. Store source provenance in local metadata and/or Composition context.
10. Produce migration report.

Acceptance:

- legacy source names are traceable but not the clinical model.
- failed records can be reviewed and rerun.
- source files can be checksummed and linked to generated Compositions.

### Workstream K: Operations And Deployment

Purpose:

- make the platform deployable and supportable.

Deliverables:

- Docker Compose/deployment templates.
- environment variable documentation.
- backup/restore runbook.
- CDR upgrade runbook.
- monitoring dashboard.
- incident response checklist.

Implementation tasks:

1. Document local EHRbase setup.
2. Add health checks.
3. Add CDR smoke commands.
4. Add backup scripts or runbook.
5. Add restore verification steps.
6. Add log fields and metrics.
7. Add CDR upgrade testing procedure.
8. Add secret rotation procedure.
9. Add TLS/proxy deployment notes.

Acceptance:

- a new deployment can bring up application and CDR.
- restore has been tested.
- CDR outage behavior is safe and user-visible.

### Workstream L: SNOMED CT Browser And Terminology Service

Purpose:

- provide safe clinical terminology browsing and binding.
- keep terminology dependencies server-side and replaceable.
- support CSNOFinder where useful without coupling the form builder to one browser implementation.

Deployment options:

1. External browser link:
   - lowest implementation effort.
   - opens local CSNOFinder or an approved browser in a new tab.
   - useful for clinical review and discovery.
   - not sufficient for structured binding by itself.
2. Embedded browser panel:
   - embeds or frames local CSNOFinder only if deployment and security policy allow it.
   - useful for admin/reviewer workflows.
   - should still write selected concepts through application APIs.
3. API-backed Svelte picker:
   - preferred production path.
   - Svelte UI calls `/api/v1/terminology/*`.
   - server wraps Snowstorm, Snowstorm Lite, CSNOServ, or another approved terminology server.
   - builder/runtime code stays independent of terminology provider.

Provider choices:

- Snowstorm:
  - best first production option when Elasticsearch and Java service deployment are acceptable.
  - supports SNOMED CT search, hierarchy, descriptions, ECL, and FHIR terminology APIs.
- Snowstorm Lite:
  - useful for lower-resource local or offline deployment.
  - evaluate feature coverage before relying on advanced authoring workflows.
- C-DAC CSNOtk:
  - India-friendly option that includes CSNOLib, CSNOServ, CSNOCtrl, and CSNOFinder.
  - CSNOFinder can serve as the human browser.
  - CSNOServ or CSNOLib should be evaluated for the application API backend.
  - avoid making jQuery-based CSNOCtrl a core dependency of Svelte form rendering.
- Managed terminology service:
  - acceptable if licensing, latency, audit, data residency, and service continuity are governed.

Deliverables:

- terminology provider configuration.
- server-only terminology client abstraction.
- SNOMED CT concept search endpoint.
- SNOMED CT concept lookup endpoint.
- value-set/refset expansion endpoint.
- code validation endpoint.
- optional ECL execution endpoint.
- dictionary concept picker.
- option-set concept picker.
- admin browser link to CSNOFinder or approved browser.
- terminology binding storage.
- terminology audit events.
- terminology service health check.

Implementation tasks:

1. Decide initial terminology provider.
2. Confirm SNOMED CT licensing, edition, release package, and national extension requirements.
3. Define configured edition, version, branch, language refset, and allowed maps.
4. Add server-only terminology config.
5. Add typed terminology client abstraction.
6. Implement `searchConcepts`.
7. Implement `lookupConcept`.
8. Implement `validateCode`.
9. Implement `expandValueSet`.
10. Implement hierarchy operations for parents and children.
11. Implement optional ECL execution for authoring workflows.
12. Add dictionary binding UI using the application API.
13. Add option-set binding UI using the application API.
14. Add reviewer workflow for binding strength and approval.
15. Store selected terminology metadata on dictionary versions and option values.
16. Record audit events for search, select, approve, replace, retire, expand, and validate operations.
17. Add service-health checks and safe failure messages.
18. Add provider conformance tests using known SNOMED CT examples.

Acceptance:

- builder users can search and select SNOMED CT concepts without direct browser-to-terminology-server coupling.
- selected concepts store concept ID, preferred term, fully specified name, semantic tag, active status, module, edition, version, language refset, binding strength, selected-by, selected-at, reviewed-by, and reviewed-at.
- option sets can be explicitly curated or backed by refset/ECL expansion.
- published bindings are immutable except through a reviewed new version or amendment.
- runtime fixed option sets still render using stored terms if the terminology service is unavailable.
- runtime free terminology search fails closed with a safe message if the terminology service is unavailable.
- public SNOMED browser APIs are not used as production runtime dependencies.

## Policy Matrix

| Policy Area | Rule | Enforcement Point |
| --- | --- | --- |
| Browser access | Browser never calls CDR directly | routing/API design |
| Clinical submit | Must have patient-to-EHR link | runtime service |
| Clinical submit | Must pass AuthZ, purpose, consent | access service |
| Clinical submit | Must be accepted by CDR | CDR bridge |
| Correction | Requires reason and new version | runtime service/CDR |
| Void/delete | Logical only, elevated privilege | runtime service/CDR |
| Template publish | Requires Web Template and CDR readiness | template registry |
| Dictionary publish | Requires clinical, terminology, privacy review | dictionary service |
| Terminology search | Browser calls application API, not provider directly | terminology API |
| Terminology binding | Requires edition/version and reviewer metadata | dictionary service |
| SNOMED CT content | Release files and extensions require licensing governance | operations/config |
| Export | Requires export purpose and audit | query/export service |
| Research | Deidentify by default | export service |
| Break glass | Requires reason, time limit, review | access service |
| Migration | Requires source provenance and reviewed mapping | integration service |

## Screen Inventory

### Builder And Governance Screens

- Dictionary list/search.
- Dictionary item editor.
- Option set editor.
- Terminology binding panel.
- SNOMED CT concept browser/picker.
- Value-set/refset expansion preview.
- Privacy/access policy panel.
- Archetype registry.
- Template registry.
- Template editor.
- Web Template/path validation view.
- Template publish checklist.
- Version diff view.
- Retirement impact view.

### Runtime Screens

- Patient lookup/registration.
- Patient-EHR link status.
- Runtime form launcher.
- Runtime form editor.
- Draft list.
- Submission success/version detail.
- Correction/addendum workflow.
- Patient timeline.
- Composition viewer.
- Intervention worklist.
- Referral/procedure workflow.

### Query And Governance Screens

- Saved query list.
- Dictionary-driven query builder.
- Query results with lineage.
- Export request screen.
- Access audit review.
- Break-glass review.
- Migration dataset list.
- Source mapping editor.
- Conversion job monitor.

## API Inventory

Recommended endpoint families for an HTTP implementation:

```text
/api/v1/ehr/*
/api/v1/ehr/templates/*
/api/v1/ehr/compositions/*
/api/v1/ehr/query/*

/api/v1/emr-dictionary/*
/api/v1/emr-templates/*
/api/v1/emr-runtime/*
/api/v1/emr-query/*
/api/v1/terminology/*
/api/v1/patient-identity/*
/api/v1/consent-access/*
/api/v1/emr-integration/*
```

Every route needs:

- validation schema.
- AuthZ privilege.
- rate limit.
- request ID.
- safe errors.
- audit classification.

Mutations additionally need:

- before/after audit where applicable.
- reason for sensitive operations.
- idempotency key where retries are likely.
- conflict detection.

## Data Model Inventory

Minimum tables or equivalent document stores:

```text
patients
patient_identifiers
patient_ehr_links
patient_merge_events

archetype_registry
template_registry
template_archetype_links
web_template_cache

dictionary_items
dictionary_item_semantics
dictionary_item_input_metadata
dictionary_item_open_ehr_mapping
dictionary_item_validation
option_sets
option_values
terminology_bindings
terminology_value_sets
terminology_expansions
terminology_provider_health

runtime_drafts
clinical_submissions
field_instance_refs
composition_links

consent_profiles
consent_rules
care_relationships
access_decision_logs
break_glass_events

saved_queries
saved_query_parameters
query_execution_logs
exports

source_datasets
source_records
source_field_mappings
conversion_jobs
conversion_results
```

## Example First Vertical Slice

Build a deliberately small end-to-end slice before broad builder work.

Clinical content:

- patient registration in application database.
- one simple Observation template.
- one numeric Element.
- one CDR Composition submit.
- one AQL query.

Steps:

1. Register or select test patient.
2. Create/link `ehr_id`.
3. Upload/register template.
4. Fetch/cache Web Template.
5. Create dictionary item for one Element.
6. Publish one form/template.
7. Render runtime form.
8. Save draft.
9. Submit Composition.
10. Store local version reference.
11. Query it with AQL.
12. Show patient timeline row.
13. Correct value with reason.
14. Confirm new version exists.

Exit criteria:

- no browser CDR calls.
- CDR validates payload.
- AQL returns submitted value.
- local reference points to exact version.
- correction creates a second version.

## Documentation Deliverables

Portable docs:

- openEHR implementation standard.
- glossary.
- data dictionary authoring guide.
- template governance guide.
- CDR bridge operations guide.
- consent/access policy guide.
- migration guide.
- query/reporting guide.

Deployment docs:

- VCMS adapter guide.
- local EHRbase setup.
- backup/restore runbook.
- first ophthalmology dictionary pack.
- first generic clinic dictionary pack.

User docs:

- builder user guide.
- clinician runtime form guide.
- patient chart guide.
- reporting guide.
- break-glass workflow guide.

## Final Acceptance For Platform Pilot

The platform is pilot-ready when all of these are true:

- a non-demo patient can be linked to an EHRbase `ehr_id`.
- at least one clinically reviewed template is published.
- runtime form data can be submitted as a Composition.
- AQL can retrieve submitted clinical data.
- correction creates a new CDR version with reason.
- dictionary and template versions are immutable after publication.
- access policy filters sensitive data.
- break-glass is implemented and audited.
- export policy is implemented.
- one migration source can be dry-run and reviewed.
- backup and restore have been tested.
- clinicians have reviewed the runtime UI.
- administrators can review audit events.
