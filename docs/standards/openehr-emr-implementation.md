---
title: openEHR EMR Implementation Standard
status: draft
owner: engineering
last_reviewed: 2026-05-11
portable: true
---

# openEHR EMR Implementation Standard

## Purpose

This standard defines a reusable openEHR-first architecture for building an Electronic Medical Record system. It is intentionally portable: a project can apply it in VCMS, another SvelteKit application, a mobile-first EMR, or a different clinical platform as long as the same openEHR concepts are preserved.

The standard assumes the implementation will use an existing openEHR Clinical Data Repository such as EHRbase rather than building a custom CDR, Reference Model persistence engine, Operational Template processor, validation engine, or AQL engine.

## Core Position

Use openEHR as the clinical record architecture, not as a thin export format.

The application may own presentation, workflow, local demographics, identity matching, consent, and operational orchestration, but submitted clinical truth should be stored as versioned openEHR Compositions in a CDR.

```text
Application UI
  -> application services
  -> virtual EHR bridge
  -> openEHR REST / Web Template / AQL
  -> openEHR CDR
```

## Non-Negotiable Principles

### Use An Existing CDR

The EMR must use an openEHR CDR for clinical persistence. The application must not implement its own canonical openEHR Reference Model database, AQL engine, template validation engine, or versioned Composition store unless the project is explicitly a CDR implementation project.

### Keep Demographics Separate From EHR Data

Patient demographics, search indexes, local identifiers, phone numbers, and operational identifiers belong in the application database or a dedicated demographic/MPI service. The CDR stores clinical EHR content and references a subject.

```text
Application patient_id
  maps to
EHRbase ehr_id
```

The application must never use OPD number, barcode, mobile number, or a local registration identifier as the openEHR `ehr_id`.

### Store Submitted Clinical Records As Compositions

A submitted clinical document, visit note, procedure record, observation set, referral request, or follow-up record should become an openEHR Composition unless there is a clear reason to store it only as operational metadata.

Drafts may remain mutable in the application database. Submitted clinical data must use CDR versioning.

### Build With Archetypes And Templates

Forms are not the primary model. Templates and archetypes are the clinical model; forms are a presentation of that model.

```text
Archetype
  reusable clinical concept

Template
  local composition/document definition using archetypes

Web Template
  frontend-friendly JSON view of the template

Form
  UI rendering of a template plus local presentation metadata
```

### Use Web Templates As The Frontend Bridge

Do not make frontend code understand the full openEHR Reference Model. Use Web Template JSON, flat paths, and application-owned UI metadata to render forms and map input to Composition payloads.

### Preserve Versioning And Contributions

Clinical data is never silently overwritten. Changes create new Versions. Related changes should be grouped as Contributions when they are one logical unit of work.

### Query With AQL

Clinical querying should be expressed through AQL over archetype/template paths. The application should provide curated query builders and saved queries rather than exposing unrestricted raw AQL to ordinary users.

### Enforce Access Outside The Browser

The browser must not talk directly to the CDR. All access flows through application services that enforce authentication, authorization, consent, purpose-of-use, sensitivity, and audit policy.

## Five-Tier Reference Architecture

### Tier 1: Persistence

Persistence is responsible for durable storage.

Expected components:

- openEHR CDR database, for example EHRbase PostgreSQL.
- application database for demographics, user accounts, operational configuration, drafts, local audits, and mapping metadata.
- optional terminology index/cache.
- optional object storage for media and attachments.

### Tier 2: Back-End Services

Back-end services expose coarse-grained capabilities.

Expected services:

- EHR service through EHRbase.
- demographic or patient identity service.
- authentication and authorization service.
- consent and purpose-of-use service.
- terminology service.
- archetype/template registry.
- audit and observability service.
- optional integration/import service.

### Tier 3: Virtual EHR

The virtual EHR layer hides service separation and exposes a coherent clinical API to application logic.

Expected responsibilities:

- EHR identity linking.
- template upload and retrieval.
- Web Template cache.
- Composition payload mapping.
- Composition create/update/correct/delete wrappers.
- Contribution handling.
- AQL query service.
- path and locator helpers.
- EHRbase error normalization.

### Tier 4: Application Logic

Application logic is specific to a product or care setting.

Expected responsibilities:

- form/runtime orchestration.
- clinical workflow and referral queues.
- draft lifecycle.
- local validation before CDR submission.
- patient matching and duplicate resolution.
- report definitions.
- consent and access decisions.
- data import conversion jobs.

### Tier 5: Presentation

Presentation includes web, mobile, and print surfaces.

Expected responsibilities:

- form rendering.
- field property editing.
- patient chart views.
- workflow dashboards.
- AQL/report builder UI.
- dictionary/template governance UI.
- clinician-friendly validation messages.

The presentation layer must not import server-only modules, database clients, CDR credentials, or raw CDR client code.

## Core Domain Model

### Patient Identity

Every implementation needs a local map between the person/patient record and the openEHR EHR.

```text
patient_ehr_link
  patient_id
  ehr_id
  subject_id
  subject_namespace
  status: active | duplicate | merged | retired
  created_at
  verified_by
  verified_at
```

Duplicate patient/EHR matching is a clinical safety risk. It must be treated as a governed workflow, not as simple data cleanup.

### Data Dictionary

The data dictionary is the reusable repository of clinical and operational building blocks. It must not be limited to fields.

Reusable object types:

- Element: one data value.
- Cluster: structured group of Elements.
- Option set: reusable coded choices.
- Observation: measured or observed clinical facts.
- Evaluation: clinical judgement, diagnosis, risk, prognosis.
- Instruction: order, request, plan, or referral.
- Action: performed intervention or completed task.
- Admin entry: administrative record content.
- Section: document heading/grouping.
- Fragment: reusable bundle of Entries, Clusters, Elements, and options.
- Composition template: complete clinical document/form definition.

Each dictionary object should be versioned independently. Published templates should snapshot the dictionary content they use so historic forms remain reproducible.

### Entry Classes

Every clinical field or fragment should have an intended openEHR Entry class where possible.

```text
entry_class:
  OBSERVATION
  EVALUATION
  INSTRUCTION
  ACTION
  ADMIN_ENTRY
  UNMAPPED
```

Examples:

- visual acuity, intraocular pressure, refraction: `OBSERVATION`.
- diagnosis, risk, severity, prognosis: `EVALUATION`.
- referral, surgery request, investigation order: `INSTRUCTION`.
- surgery performed, spectacles dispensed, procedure completed: `ACTION`.
- registration metadata and visit administration: `ADMIN_ENTRY`.

### Clinical Categories

Entry class is not enough for clinical authoring. A second category should capture clinical intent.

```text
clinical_category:
  history
  observation
  action
  opinion
  assessment
  diagnosis
  risk
  prognosis
  proposal
  scenario
  goal
  recommendation
  instruction
  investigation_request
  intervention_request
  admin_information
```

### Composition Structure

The implementation should evolve from simple section/field models to Composition templates.

```text
composition_template
  sections[]
    entries[]
      structures[]
        elements[]
```

An Element belongs in an Entry/Cluster/List/Table context. It is not a free-floating field.

### Field And Input Metadata

Input metadata remains necessary, but it is only the UI layer.

```text
input_metadata
  field_name
  label
  help_text
  widget_type
  width
  required
  read_only
  hidden
  input_mask
  text_case
  barcode_allowed
  max_text_width
  validation
```

This input metadata must be stored separately from clinical semantics.

### openEHR Mapping Metadata

Every mapped object should support openEHR mapping metadata.

```text
open_ehr_mapping
  rm_type
  dv_type
  archetype_id
  archetype_node_id
  archetype_root
  template_id
  web_template_path
  aql_path
  locatable_ref
  dv_ehr_uri
```

The application's local field identifier remains distinct from the openEHR archetype path. Do not treat local field names as durable clinical identity.

### Time Semantics

A date/time field must declare what the time means.

```text
time_semantics:
  encounter_start
  encounter_end
  observation_time
  action_time
  instruction_time
  data_entry_time
  commit_time
  clinical_content_time
  not_time_related
```

Examples:

- measurement time for IOP: observation time.
- cataract surgery date: action time.
- symptom onset: clinical content time.
- save time: commit time, controlled by the CDR audit.

### Terminology

Terminology must be a first-class reusable layer, not a textbox.

```text
terminology_mapping
  archetype_node_id
  archetype_value_code
  value_set_constraint
  external_bindings[]
    terminology
    code
    display
    binding_strength
```

Supported binding targets should include, as relevant:

- SNOMED CT.
- LOINC.
- ICD-10 or local reporting classifications.
- UCUM for units.
- openEHR internal terminology/code sets.

Option sets must support code bindings per option.

### Units

All measurement units should use UCUM where possible.

Examples:

- intraocular pressure: `mm[Hg]`.
- body weight: `kg`.
- height: `cm` or `m`, consistently.

### Paths And Locators

The application must distinguish semantic paths from runtime locators.

```text
semantic_path
  reusable archetype/template path

runtime_locator
  exact submitted node reference in a specific Composition Version
```

Archetype paths are not always unique in runtime data because repeated nodes may share the same `archetype_node_id`.

Preferred uniqueness strategies:

1. `LOCATABLE.uid`, if available.
2. archetype node plus stable name/time predicate.
3. exact version plus runtime path.
4. positional path only when order is guaranteed.

### DV_EHR_URI

Use `DV_EHR_URI`-style locators to link clinical items.

```text
ehr:/<ehr_id>/compositions/<version_uid>/<path_inside_composition>
```

Use cases:

- Action fulfils Instruction.
- Follow-up Observation refers to prior diagnosis.
- Summary is derived from source Compositions.
- Correction replaces or corrects prior Version.

Exact-version locators should be used for traceability. Latest-version locators may be used for UI navigation.

## Intervention And Workflow Model

Interventions must be modelled as Instruction/Action pairs.

```text
INSTRUCTION = what is requested, planned, ordered, or intended
ACTION = what actually happened
```

State values:

```text
intervention_state:
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

Workflow transitions:

```text
initiate
plan_step
schedule
start
suspend
resume
postpone
restore
finish
cancel
abort
time_out
```

Examples:

- cataract surgery referral: Instruction.
- cataract surgery performed: Action.
- spectacles prescribed: Instruction.
- spectacles dispensed: Action.
- investigation requested: Instruction.
- investigation performed plus result: Action and Observation.

## Versioning And Change Control

### Drafts

Drafts are mutable application state. They may live in the application database and are not the clinical source of truth.

### Submitted Records

Submitted clinical records are immutable Versions in the CDR. Corrections and amendments create new Versions.

### Change Types

```text
change_type:
  creation
  modification
  correction
  deletion
  import
  attestation
  synthesis
```

Deletion means logical deletion/voiding through versioning, not physical deletion.

### Contributions

A Contribution is one logical commit to the EHR repository. It may include multiple Composition changes.

Examples:

- Create surgery Action and update referral Instruction state in one Contribution.
- Import a batch of related legacy data as traceable Contributions.
- Add an attestation to a Version.

### Local Reference Tracking

Every submitted record should be tracked locally.

```text
clinical_submission_ref
  form_instance_id
  patient_id
  ehr_id
  template_id
  composition_uid
  version_uid
  contribution_uid
  creating_system_id
  version_tree_id
  committed_by
  committed_at
  change_type
  change_reason
  source_definition_version
```

## Security, Consent, And Access

openEHR defines a place for access policy through EHR Access, but the concrete deployment must implement authentication, authorization, consent, and purpose-of-use checks.

The application must evaluate:

```text
Can user X access data Y
for patient Z
at site S
for purpose P
under consent C
with relationship R?
```

Access must consider:

- patient consent.
- care relationship.
- site and local staffing context.
- role/privilege.
- purpose of use.
- data sensitivity.
- emergency override.
- auditability.

Field and fragment policy metadata:

```text
privacy_class:
  routine
  sensitive
  restricted
  administrative
  research_eligible
  never_export_without_consent

purpose_allowed:
  direct_care
  referral_care
  emergency_care
  operations
  billing
  quality_improvement
  research
  teaching

access_requirements:
  active_care_relationship
  patient_consent_required
  site_role_required
  break_glass_allowed
  deidentify_before_export
  explicit_audit_required
```

Break-glass access must be explicit, reasoned, audited, and reviewable.

Research and teaching access must be consent-scoped or deidentified.

## Runtime Form Lifecycle

Template/form lifecycle:

```text
draft
locally_validated
template_uploaded
web_template_cached
ehrbase_validation_ready
published
retired
```

Runtime submission lifecycle:

```text
open form
  -> create draft from Web Template defaults
  -> user edits draft
  -> local UI validation
  -> server validation/AuthZ/consent
  -> map draft to Composition payload
  -> submit to CDR
  -> CDR validates template/archetype/RM constraints
  -> store CDR references locally
  -> display committed version
```

If the CDR rejects the Composition, the application must not mark the form submitted.

## Query And Reporting

The application should maintain AQL-ready metadata for reusable dictionary objects.

```text
query_mapping
  aql_archetype_id
  aql_select_path
  aql_filter_path
  result_alias
  value_type
  unit
  terminology_binding
  supports_aggregation
  supports_time_filter
```

Query builders should compose from dictionary items rather than forcing users to hand-write raw AQL.

Example query intent:

```text
Find patients where:
  diagnosis = cataract
  and IOP > 21 mm[Hg]
  and referral state = active
  and surgery action is not completed
```

The application query service translates that intent into AQL over:

- Evaluation diagnosis.
- Observation IOP.
- Instruction referral.
- linked Action surgery completion.

## Integration And Migration

External forms, XLS files, ODK definitions, CSVs, HL7 messages, and legacy database rows are source material. They are not the permanent clinical model.

Use a two-step conversion approach:

```text
source data
  -> source-shaped staging model with provenance
  -> mapping rules
  -> designed openEHR Composition payload
  -> CDR
```

Source mapping metadata:

```text
source_mapping
  source_system
  source_form
  source_field
  source_value
  dictionary_item_id
  transform_rule
  confidence
  reviewed_status
```

Conversion result metadata:

```text
conversion_result
  source_record_id
  patient_id
  ehr_id
  composition_uid
  version_uid
  mapping_version
  validation_status
```

Legacy source names should be preserved for traceability but must not become durable clinical identifiers.

## Deployment Modes

### Single-Site Local Deployment

Recommended for small clinics and pilot deployments:

- one application database.
- one EHRbase instance.
- local patient identity map.
- local terminology/dictionary cache.
- backup and restore procedures for both databases.

### Multi-Site Connected Deployment

Recommended for networks of clinics:

- central or federated patient identity service.
- site-aware access control.
- shared template/dictionary governance.
- local operational data per site where needed.
- CDR deployment selected by latency, governance, and legal requirements.

### Offline Or Intermittently Connected Deployment

Recommended only with explicit conflict and identity policy:

- local draft capture.
- deferred Composition submission.
- duplicate-patient risk handling.
- source-system provenance.
- post-sync validation and reconciliation.

## Implementation Modules

A platform-neutral implementation should have these logical modules.

```text
ehr-bridge
  CDR client
  template upload
  Web Template cache
  Composition submit/update/query
  Contribution handling

emr-dictionary
  reusable Elements, Clusters, Entries, Sections, Fragments, Option Sets
  terminology bindings
  privacy/access metadata

emr-template-registry
  archetype registry
  template lifecycle
  publication state
  form generation metadata

emr-runtime
  drafts
  form execution
  Composition payload mapper
  submission references

emr-query
  saved queries
  AQL builder
  report definitions
  result mapping

patient-identity
  patient records
  ehr_id mapping
  duplicate/merge workflows

consent-access
  consent profile
  purpose of use
  care relationship
  break-glass workflow

integration
  source imports
  staging records
  mapping rules
  conversion jobs
```

## Minimum Viable openEHR EMR

A minimum viable implementation must include:

- patient-to-`ehr_id` linkage.
- template upload or template registration.
- Web Template retrieval/cache.
- runtime form rendering from published definitions.
- Composition submit to the CDR.
- local reference tracking for returned Composition/version IDs.
- basic AQL query endpoint/service.
- audit log for clinical submissions.
- consent/access check before viewing clinical data.
- dictionary entries with clinical class, datatype, terminology, and path metadata.

## Explicit Non-Goals

The EMR application should not:

- implement a custom AQL engine.
- store submitted clinical truth only in local relational tables.
- use local field names as the durable clinical model.
- expose EHRbase credentials to the browser.
- let raw CDR errors leak to users.
- treat form builder fields as independent of Entry/Cluster/Composition structure.
- overwrite submitted clinical records in place.
- treat legacy forms as the target model.

## Quality Gates

Every implementation phase should verify:

- template and Web Template retrieval works.
- Composition submission succeeds and rejects invalid payloads.
- AQL query returns expected data.
- local references match CDR responses.
- access checks run before CDR reads are displayed.
- submitted clinical data creates new CDR versions on correction.
- migration imports preserve source provenance.
- dictionary and template versions are immutable after publication.

## Glossary

This glossary defines terms the implementation must use consistently.

| Term | Meaning | Implementation Responsibility |
| --- | --- | --- |
| Patient | Real person receiving care | application/MPI |
| Subject | The openEHR subject reference for an EHR | application and CDR |
| EHR | Longitudinal clinical record for a subject | CDR |
| `ehr_id` | Globally unique openEHR EHR identifier | CDR generated or CDR accepted |
| Composition | Top-level clinical document/event committed to the EHR | CDR |
| Versioned Object | Container holding all versions of a top-level item | CDR |
| Version UID | Exact identifier of a committed version | CDR |
| Contribution | Logical change-set containing one or more version changes | CDR |
| Archetype | Reusable formal clinical model | archetype registry |
| Template | Local composition/document definition assembled from archetypes | template registry/CDR |
| Web Template | JSON representation of a template for application use | CDR and application cache |
| Element | Leaf data value in a structure | dictionary/template |
| Cluster | Group of Elements or structures | dictionary/template |
| Entry | Clinical statement: Observation, Evaluation, Instruction, Action, Admin Entry | dictionary/template/CDR |
| AQL | Archetype Query Language | CDR query engine, application query service |
| DV_EHR_URI | Portable locator for EHR content | CDR/application link metadata |
| Draft | Mutable local working copy before clinical commit | application |
| Submitted record | Clinical truth committed to CDR | CDR |
| Correction | New version correcting a prior version | application plus CDR |
| Attestation | Additional sign-off on a version | CDR/application governance |
| Purpose of use | Reason for access, such as direct care or research | access service |
| Break glass | Emergency override of ordinary access limits | access service and audit |

## System Boundary Contracts

### Browser Contract

The browser may receive:

- published form definitions stripped of server-only metadata.
- localized labels, hints, and validation messages permitted for the current user.
- access-filtered clinical values.
- opaque local identifiers and route-safe references.

The browser must never receive:

- CDR credentials.
- raw database credentials.
- unrestricted AQL execution privileges.
- unpublished definitions unless the user is in a builder/admin workflow.
- restricted field metadata that would itself reveal sensitive hidden data.
- raw stack traces or raw CDR/database errors.

### Application Server Contract

The application server owns:

- authentication.
- route authorization.
- data-level access checks.
- CDR client credentials.
- CDR error mapping.
- patient-to-EHR identity linkage.
- draft state.
- dictionary/template governance.
- local audit and operational logs.

The application server must verify:

- user identity.
- site context.
- patient context.
- purpose of use.
- consent.
- care relationship.
- dictionary/template version.
- CDR template availability.
- payload validation state.

### CDR Contract

The CDR owns:

- EHR creation and retrieval.
- template validation where supported.
- Composition create/update/delete semantics.
- version history.
- Contributions.
- openEHR audit details.
- AQL execution.

The application must assume the CDR can reject a payload even if local validation passed.

## Recommended Database Model

The following logical schema is implementation-neutral. Column names may be adapted, but the concepts must remain.

### Patient And EHR Linkage

```text
patients
  id
  status
  primary_display_name
  birth_date
  sex_at_registration
  created_at
  updated_at

patient_identifiers
  id
  patient_id
  identifier_type
  identifier_value
  issuer
  status
  valid_from
  valid_to
  created_at

patient_ehr_links
  id
  patient_id
  ehr_id
  subject_id
  subject_namespace
  cdr_system_id
  status
  identity_confidence
  created_at
  created_by
  verified_at
  verified_by
  retired_at
  retired_by
  retirement_reason

patient_merge_events
  id
  surviving_patient_id
  merged_patient_id
  merge_reason
  merge_confidence
  reviewed_by
  reviewed_at
  audit_event_id
```

Policy:

- `patient_ehr_links` must enforce only one active link per patient per CDR unless the deployment explicitly supports federated EHR copies.
- Merge operations must be reversible at the application metadata level where practical.
- No clinical Composition may be moved between EHRs without a governed correction/import workflow.

### Archetype And Template Registry

```text
archetype_registry
  id
  archetype_id
  semantic_concept
  rm_type
  source_repository
  source_version
  lifecycle_state
  imported_at
  imported_by
  checksum
  license
  review_status

template_registry
  id
  template_id
  template_version
  cdr_template_id
  title
  clinical_domain
  lifecycle_state
  source_format
  source_checksum
  web_template_hash
  uploaded_to_cdr_at
  uploaded_to_cdr_by
  published_at
  published_by
  retired_at
  retired_by

template_archetype_links
  id
  template_registry_id
  archetype_registry_id
  role
  root_path
  required
```

Policy:

- Published templates are immutable.
- A template may be retired but must not be deleted if any submission references it.
- Template source, generated Web Template, and local UI metadata must be hashable and traceable.

### Dictionary Registry

```text
dictionary_items
  id
  stable_key
  version
  item_type
  title
  description
  lifecycle_state
  clinical_domain
  owner
  created_at
  created_by
  published_at
  published_by
  retired_at
  retired_by

dictionary_item_semantics
  dictionary_item_id
  entry_class
  clinical_category
  clinical_concept_text
  body_site
  laterality
  time_semantics
  normal_unit_ucum
  repeat_context

dictionary_item_open_ehr_mapping
  dictionary_item_id
  rm_type
  dv_type
  archetype_id
  archetype_node_id
  archetype_root
  template_id
  web_template_path
  aql_select_path
  aql_filter_path
  uniqueness_strategy

dictionary_item_input_metadata
  dictionary_item_id
  widget_type
  field_name
  label
  help_text
  guidance_hint
  width
  max_text_width
  barcode_allowed
  input_mask
  text_case
  required_policy
  read_only_policy
  hidden_policy

dictionary_item_validation
  dictionary_item_id
  min_value
  max_value
  min_length
  max_length
  pattern
  constraint_expression
  required_expression
  calculation_expression
  trigger_expression
  validation_message
  required_message
```

Policy:

- A dictionary stable key identifies the concept family. The version identifies the exact published definition.
- Published dictionary item versions are immutable.
- A form/template stores snapshots or exact version references, never moving references to mutable dictionary drafts.

### Option Sets And Terminology

```text
option_sets
  id
  stable_key
  version
  title
  lifecycle_state
  selection_mode
  created_at
  published_at

option_values
  id
  option_set_id
  stable_value
  display_order
  label
  description
  active
  default_selected

terminology_bindings
  id
  owner_type
  owner_id
  terminology_system
  terminology_version
  code
  display
  binding_strength
  purpose
  created_at
  reviewed_by
  reviewed_at
```

Policy:

- Local option values must be stable after publication.
- Display labels may be localized or revised in a new version.
- External terminology binding changes require review because they can change query semantics.

### Runtime Drafts And Submissions

```text
runtime_drafts
  id
  patient_id
  ehr_id
  template_registry_id
  form_definition_version
  status
  created_by
  created_at
  updated_by
  updated_at
  expires_at
  payload_json
  validation_state_json

clinical_submissions
  id
  patient_id
  ehr_id
  template_registry_id
  draft_id
  composition_uid
  version_uid
  contribution_uid
  change_type
  lifecycle_state
  change_reason
  cdr_system_id
  committed_by
  committed_at
  source_request_id
  source_definition_version

field_instance_refs
  id
  clinical_submission_id
  dictionary_item_id
  field_key
  semantic_path
  runtime_data_path
  locatable_uid
  dv_ehr_uri
  value_fingerprint
```

Policy:

- Drafts can be edited according to local ownership and privilege rules.
- Submitted records cannot be edited locally. Changes must go through CDR versioning.
- Each submitted payload must have a local reference row before the user is shown success.

### Consent And Access

```text
consent_profiles
  id
  patient_id
  status
  effective_from
  effective_to
  default_direct_care
  default_research
  default_teaching
  default_quality_improvement
  created_at
  created_by

consent_rules
  id
  consent_profile_id
  privacy_class
  purpose_of_use
  decision
  condition_json
  explanation

care_relationships
  id
  patient_id
  user_id
  site_id
  relationship_type
  status
  starts_at
  ends_at
  source

access_decision_logs
  id
  user_id
  patient_id
  ehr_id
  purpose_of_use
  resource_type
  resource_ref
  decision
  reason
  policy_version
  request_id
  decided_at

break_glass_events
  id
  user_id
  patient_id
  reason
  started_at
  ended_at
  reviewed_by
  reviewed_at
  review_outcome
```

Policy:

- Access decisions must be logged for restricted, sensitive, exported, research, and break-glass access.
- Break-glass is time-limited and must trigger review.
- Consent revocation must affect future access, exports, and query results. Historic audit remains intact.

## API And Service Contracts

### EHR Bridge API

Required service methods:

```text
createEhr(subject)
findEhrBySubject(subjectId, namespace)
linkPatientToEhr(patientId, ehrId, subject)
uploadTemplate(templateSource)
getWebTemplate(templateId)
submitComposition(ehrId, templateId, payload, format, audit)
updateComposition(ehrId, versionedObjectUid, payload, ifMatch, audit)
getComposition(ehrId, versionOrObjectUid, format)
queryAql(query, parameters, accessContext)
```

All methods must:

- accept request context.
- emit structured logs.
- map CDR errors to stable application errors.
- avoid leaking credentials.
- include timeout and retry policy.

### Dictionary API

Required service methods:

```text
createDraftDictionaryItem(input)
updateDraftDictionaryItem(id, patch)
validateDictionaryItem(id)
publishDictionaryItem(id)
retireDictionaryItem(id, reason)
searchDictionaryItems(filters)
getDictionaryItemVersion(stableKey, version)
```

Policy:

- Publish requires validation and privilege.
- Retire requires reason and impact review.
- Search must support clinical concept, Entry class, archetype ID, terminology code, and status.

### Template Registry API

Required service methods:

```text
createDraftTemplate(input)
assembleTemplateFromDictionary(input)
validateTemplate(id)
uploadTemplateToCdr(id)
cacheWebTemplate(id)
publishTemplate(id)
retireTemplate(id, reason)
compareTemplateVersions(a, b)
```

Policy:

- Publish requires CDR validation readiness.
- Template compare must highlight semantic path, requiredness, datatype, terminology, privacy, and query-impact changes.

### Runtime API

Required service methods:

```text
openRuntimeForm(patientId, templateId, context)
saveDraft(draftId, patch)
validateDraft(draftId)
submitDraft(draftId, changeReason)
correctSubmission(submissionId, patch, reason)
voidSubmission(submissionId, reason)
getPatientTimeline(patientId, filters)
```

Policy:

- Submit requires patient-EHR link.
- Submit requires access and consent.
- Correction requires reason.
- Void requires elevated privilege and reason.

### Query API

Required service methods:

```text
createSavedQuery(input)
validateSavedQuery(id)
executeSavedQuery(id, parameters, accessContext)
executeDictionaryQuery(criteria, accessContext)
getQueryResultLineage(resultId)
```

Policy:

- Raw AQL is admin/developer only.
- User-facing query builder is dictionary-driven.
- Query results must be access-filtered before display/export.
- Query lineage must identify Composition/version/path where practical.

## Error Handling Policy

Errors must be stable, safe, and actionable.

Required categories:

```text
VALIDATION_FAILED
AUTH_REQUIRED
FORBIDDEN
CONSENT_DENIED
PURPOSE_NOT_ALLOWED
PATIENT_EHR_LINK_MISSING
PATIENT_EHR_LINK_CONFLICT
TEMPLATE_NOT_READY
TEMPLATE_NOT_FOUND
WEB_TEMPLATE_MISMATCH
CDR_UNAVAILABLE
CDR_REJECTED_COMPOSITION
CDR_VERSION_CONFLICT
CDR_QUERY_FAILED
MIGRATION_MAPPING_FAILED
TERMINOLOGY_BINDING_MISSING
```

Every API error should include:

- stable code.
- safe message.
- request ID.
- optional field/path errors.
- retry guidance where applicable.

Never expose:

- raw SQL.
- raw stack trace.
- CDR credential details.
- internal network topology.
- sensitive hidden field values.

## Validation Policy

Validation occurs in layers.

### UI Validation

Purpose:

- immediate user feedback.
- mask enforcement.
- basic required checks.
- local display conditions.

UI validation is advisory and cannot be the final authority.

### Application Server Validation

Purpose:

- schema validation.
- dictionary/template version consistency.
- access and consent.
- business workflow rules.
- source mapping checks.

### CDR Validation

Purpose:

- openEHR RM validation.
- template/archetype validation.
- Composition format validation.
- version conflict detection.

CDR rejection always wins. The application must not mark a submission committed if the CDR rejects it.

## Authoring Governance

### Roles

Recommended governance roles:

- Dictionary author.
- Clinical reviewer.
- Terminology reviewer.
- Privacy reviewer.
- Template publisher.
- Runtime operator.
- Data migration reviewer.
- Security auditor.
- System administrator.

### Review Requirements

Dictionary item publish requires:

- clinical semantic review.
- datatype and unit review.
- terminology review when coded.
- privacy/access review.
- query mapping review if reportable.

Template publish requires:

- all dictionary references resolved to published versions.
- Web Template path validation.
- CDR validation readiness.
- privacy impact review.
- test Composition.
- query smoke test for key fields.

Migration mapping publish requires:

- source field inventory.
- transformation review.
- sample conversion review.
- failure policy.
- provenance policy.

### Change Impact Levels

```text
impact_level:
  cosmetic
  display_only
  validation_change
  terminology_change
  path_mapping_change
  datatype_change
  privacy_policy_change
  workflow_change
  breaking_change
```

Breaking changes require a new template/dictionary version and migration or retirement plan.

## Modelling Toolchain

An openEHR EMR implementation should deliberately separate tools by purpose. No single tool should be treated as the whole modelling workflow.

### Authoritative Sources

Authoritative sources are the places from which clinical models, specifications, and runtime artefacts are accepted into the implementation.

Recommended authoritative sources:

- openEHR specifications for Reference Model, Archetype Model, AQL, paths, and service concepts.
- CKM or another governed archetype repository for published archetypes.
- locally governed archetype repositories for approved local specialisations.
- approved template source files under version control.
- EHRbase or the selected CDR for uploaded templates, Web Templates, and committed Compositions.

Policy:

- The application must record source, version, checksum, import date, and reviewer for imported archetypes/templates.
- Convenience tools may assist discovery and planning but must not silently become authoritative source of truth.

### Discovery And Planning Tools

Discovery tools help modelers find candidate archetypes, understand dependencies, and plan template structure.

Archetype Companion is appropriate in this layer. It can be used to:

- search and browse archetypes.
- create modelling projects/checklists.
- assign candidate archetypes to clinical data elements.
- plan tentative archetype hierarchies.
- explore openEHR class glossary information.
- support the data-element-to-archetype mapping step.

Policy:

- Archetype Companion output is planning evidence, not a runtime template.
- Candidate archetype choices from Archetype Companion require clinical and technical review before import.
- Any chosen archetype must be imported from its authoritative repository or source file, not copied informally from a planning screen.
- Project/checklist exports, if used, should be stored as modelling evidence with date, author, and review state.

### Authoring Tools

Authoring tools create or modify archetypes and templates.

Candidate tools include:

- Archetype Designer.
- ADL Workbench.
- Archetype Editor for older ADL 1.4 workflows where appropriate.
- other governed template editors that can export a CDR-compatible template artefact.

Policy:

- Authoring tools must produce version-controlled artefacts.
- Local archetype specialisations require explicit reason and reviewer.
- Template exports must pass CDR upload and Web Template retrieval before publication.

### Runtime Tools

Runtime tools are used by the application and CDR.

Required runtime artefacts:

- uploaded template in the CDR.
- Web Template JSON cached by the application.
- runtime form manifest generated from Web Template plus local UI metadata.
- Composition payload mapper.
- AQL query mapping metadata.

Policy:

- Runtime must use the published template/Web Template pair, not a draft modelling checklist.
- Runtime form definitions must reference exact dictionary and template versions.

### Recommended Modelling Workflow

```text
clinical data element list
  -> Archetype Companion project/checklist for candidate discovery
  -> clinical review of candidate archetypes
  -> authoritative archetype import from CKM/source repository
  -> template authoring in approved tool
  -> template source committed/versioned
  -> template uploaded to CDR
  -> Web Template fetched and cached
  -> local runtime form metadata mapped
  -> test Composition submitted
  -> published runtime form
```

### Tool Evaluation Criteria

Any modelling tool considered for use should be evaluated for:

- supported ADL/template versions.
- export formats.
- compatibility with selected CDR.
- ability to preserve archetype IDs, node IDs, terminology bindings, and paths.
- version-control friendliness.
- collaboration and review support.
- offline behavior and data storage/privacy properties.
- license and long-term maintainability.
- ability to fit the governance workflow.

## SNOMED CT Browser And Terminology Service

SNOMED CT support has two different user needs that must not be confused:

```text
Browser need
  human searches for a concept, reviews hierarchy, synonyms, descriptions, refsets, maps

Terminology service need
  application validates codes, searches suggestions, expands value sets, runs ECL, looks up descriptions
```

The EMR should provide both, but the production application should integrate with a terminology service API rather than scraping or depending on a public web browser.

### Recommended Architecture

```text
Svelte terminology picker
  -> application terminology API
  -> local terminology service
      Snowstorm / Snowstorm Lite / CSNOServ / other approved service
  -> SNOMED CT RF2 release files + national extension/refsets

Admin browser link or embedded browser
  -> CSNOFinder or official SNOMED CT Browser for human exploration
```

The browser supports human review. The terminology service supports runtime application behavior.

### Production Rule

Do not call the public SNOMED International Browser APIs from production EMR workflows. SNOMED International states that its public browser/API endpoints are for reference or demonstration/non-production use. A clinical system should deploy or contract for its own terminology server.

### Preferred Runtime Option: Snowstorm

Snowstorm is the recommended first production-grade option when the deployment can support Elasticsearch and a Java service.

Use Snowstorm when the system needs:

- SNOMED CT search and concept lookup.
- HL7 FHIR Terminology API.
- ECL query support.
- multiple SNOMED CT editions/extensions.
- LOINC, ICD, or other code systems in the same terminology service where configured.
- scalable API behavior for production applications.

Use Snowstorm Lite when the system needs:

- lower memory footprint.
- fast SNOMED search.
- simpler local/offline deployment.
- one SNOMED CT edition.
- fewer advanced terminology-server features.

### India-Friendly Option: C-DAC CSNOtk / CSNOFinder

C-DAC's CSNOtk is relevant for Indian deployments. It includes:

- `CSNOLib`: Java API library.
- `CSNOServ`: web service.
- `CSNOCtrl`: embeddable jQuery-based control.
- `CSNOFinder`: deployable SNOMED CT browser.

CSNOFinder can be used as the human browser for clinical/admin users. CSNOServ or CSNOLib should be evaluated for application API integration. CSNOCtrl may be useful for quick prototypes, but a Svelte implementation should normally wrap server-side terminology APIs instead of embedding jQuery controls directly into core form rendering.

Policy:

- CSNOFinder is acceptable as a local browser if licensing, deployment, and SNOMED CT release-file access are satisfied.
- CSNOFinder should not become the only source of stored terminology bindings. Store selected codes, display terms, edition/version, refset, and reviewer metadata in the application database.
- For production runtime pickers, prefer a server-side terminology API wrapper so the application can swap CSNOServ, Snowstorm, Snowstorm Lite, or another terminology server without changing form code.

### SNOMED CT Content Licensing

Software licensing and terminology content licensing are separate.

Policy:

- The project must verify rights to use the selected SNOMED CT edition and national extension.
- The application must record the SNOMED CT edition/version used for each binding.
- Deployments in SNOMED member countries should follow their National Release Center process.
- Deployments outside member-country rules must confirm licensing before loading release files.
- Downloaded RF2 packages must be treated as governed clinical terminology assets.

### Terminology Service Functions

The application terminology service should expose these functions:

```text
searchConcepts(term, filters)
lookupConcept(conceptId, edition, version)
validateCode(conceptId, valueSetOrEcl)
expandValueSet(eclOrRefset)
getParents(conceptId)
getChildren(conceptId)
getDescriptions(conceptId, languageRefset)
getMaps(conceptId, targetSystem)
```

Optional advanced functions:

```text
runEcl(ecl)
subsumes(parentConceptId, childConceptId)
suggestForDictionaryItem(dictionaryItemId, term)
suggestForOptionSet(optionSetId, term)
```

### Terminology Picker Requirements

The EMR Builder terminology picker should:

- search by term and concept ID.
- filter by semantic tag.
- filter by active status.
- filter by edition/version.
- support ECL/refset-scoped searches.
- show fully specified name and preferred term.
- show synonyms.
- show hierarchy parents and children.
- show module, effective time, active status, and definition status.
- show maps to ICD-10 or LOINC where available.
- allow the user to select binding strength: exact, narrower, broader, approximate.
- require reviewer metadata for published bindings.

The runtime clinical form picker should be simpler:

- fast search/typeahead.
- scoped to allowed value set/refset/ECL.
- display preferred term.
- store concept ID, display, edition/version, and binding context.

### Stored Binding Metadata

When a user selects a SNOMED CT concept, store:

```text
terminology_system: SNOMED_CT
edition
version
module_id
concept_id
fully_specified_name
preferred_term
language_refset
semantic_tag
active
effective_time
binding_strength
binding_context
selected_by
selected_at
reviewed_by
reviewed_at
source_service
```

For value sets, store:

```text
value_set_kind: refset | ecl | explicit_list
refset_id
ecl
expanded_at
edition
version
expansion_hash
```

### UI Integration Modes

#### Mode 1: External Browser Link

Use for early implementation.

- Add a "Browse SNOMED CT" link from dictionary terminology fields.
- Open official browser or local CSNOFinder in a new tab.
- User manually copies concept ID and term.
- Requires review before publication.

This is low risk but inefficient.

#### Mode 2: Embedded Browser Panel

Use for admin/reviewer workflows.

- Embed local CSNOFinder or open it in an internal panel if its deployment supports it.
- Still persist selected bindings through the application service.
- Avoid relying on iframe scraping.

This is useful for human exploration but should not be the runtime picker implementation.

#### Mode 3: API-Backed Svelte Picker

Use for production.

- Svelte component calls application terminology API.
- Application API calls Snowstorm, Snowstorm Lite, CSNOServ, or another approved terminology service.
- Results are normalized into a stable application response.
- Selected concept metadata is stored with dictionary item/option binding.

This is the preferred long-term approach.

### Terminology Service Configuration

Each deployment should define:

```text
terminology_provider:
  snowstorm
  snowstorm_lite
  csnoserv
  external_managed_service

snomed_edition
snomed_version
language_refset
default_search_branch
allowed_refsets
allowed_ecl_scopes
icd10_map_enabled
loinc_map_enabled
```

### Failure Policy

If the terminology service is unavailable:

- Builder publishing should block new or changed terminology bindings.
- Runtime forms with fixed coded option sets may continue using stored published options.
- Runtime free terminology search should show a safe unavailable message.
- Existing submitted records remain displayable using stored display terms and codes.

### Audit Policy

Audit events are required for:

- terminology service configuration changes.
- SNOMED CT edition/version changes.
- new concept binding.
- changed concept binding.
- retired concept binding.
- value set/refset expansion refresh.
- manual code override.

### Open Questions

Before implementation, decide:

- Which terminology provider is first: CSNOtk/CSNOFinder, Snowstorm, Snowstorm Lite, or managed terminology service.
- Which SNOMED CT edition/version and national extension are in scope.
- How release files will be obtained and updated.
- Whether ophthalmology refsets are available and should constrain search.
- Whether ICD-10/LOINC maps are required in phase one.

## Privacy And Consent Policy Details

### Purpose Of Use

Supported purposes:

```text
direct_care
referral_care
emergency_care
operations
billing
quality_improvement
research
teaching
system_administration
data_migration
```

Each request for clinical data must carry or derive a purpose of use. Defaulting every request to direct care is not allowed.

### Privacy Classes

```text
routine
administrative
restricted_contact
sensitive_clinical
highly_sensitive
research_only
operational_only
```

### Decision Logic

The access service should evaluate in this order:

1. Authentication.
2. Patient/EHR existence.
3. Route/API privilege.
4. Site context.
5. Care relationship.
6. Purpose of use.
7. Consent rules.
8. Data privacy class.
9. Emergency override, if requested.
10. Audit requirement.

Failure at any step must deny access unless a configured break-glass path is available and explicitly invoked.

### Export Policy

Exports require separate policy from display.

Export checks:

- export privilege.
- purpose of export.
- recipient or destination.
- patient consent.
- deidentification requirement.
- dataset minimum necessary review.
- audit log.

Research exports must default to deidentified output unless explicit consent and governance approval permit identifiable export.

## Clinical Safety Policy

### Patient Matching

Patient matching must be conservative.

High-risk conditions:

- same phone number for multiple patients.
- missing birth date.
- reused barcode or OPD identifier.
- name-only match.
- conflicting sex or age.
- multiple active EHR links.

High-risk matches require human review before clinical submission.

### Form Publication

A form must not be published if:

- it references draft dictionary items.
- it lacks CDR template readiness.
- required paths are unmapped.
- required coded options lack stable values.
- privacy policy is missing.
- submission test has not passed.

### Corrections

Corrections must:

- require reason.
- create a new version.
- retain old version.
- identify corrector.
- show correction history in chart.

### Deletion/Void

Clinical delete means logical void/supersede where supported. Physical deletion is an administrative disaster recovery or legal process, not a normal user action.

## Observability And Audit

Required structured log fields:

```text
request_id
user_id
site_id
patient_id
ehr_id
template_id
composition_uid
version_uid
action
decision
duration_ms
error_code
```

Required audit events:

- EHR link created.
- EHR link changed or retired.
- dictionary item published/retired.
- template published/retired.
- template uploaded to CDR.
- Web Template cached/refreshed.
- draft submitted.
- Composition correction.
- Composition void.
- AQL query executed.
- restricted data viewed.
- export created.
- break-glass started/ended/reviewed.
- migration mapping published.
- migration job executed.

Audit records must be append-only at the application level. Corrections to audit metadata should themselves be audit events.

## Operational Policy

### Configuration

Required environment/configuration groups:

- CDR base URL.
- CDR auth mode.
- CDR user/admin credentials or token source.
- CDR timeout and retry.
- CDR system ID.
- application subject namespace.
- terminology service URLs.
- feature flags for Composition formats.
- break-glass policy.
- export policy.

### Backup And Restore

Backup must cover:

- CDR database.
- application database.
- template source artifacts.
- Web Template cache or regeneration procedure.
- object/media storage.
- configuration excluding secrets.

Restore testing must verify:

- patient-to-EHR links.
- Composition references.
- query function.
- dictionary/template version integrity.
- audit trail continuity.

### CDR Upgrade

CDR upgrades require:

- test environment restore.
- template upload/read checks.
- Web Template compatibility checks.
- Composition submit smoke tests.
- AQL query smoke tests.
- rollback plan.

## Deployment Checklist

Before go-live:

- CDR running and monitored.
- application database migrations applied.
- admin credentials rotated from defaults.
- TLS configured for non-local deployment.
- backups configured and restore tested.
- first templates uploaded and published.
- user roles and privileges configured.
- consent policy configured.
- break-glass workflow configured.
- audit review process assigned.
- clinical safety validation completed.
- support runbook written.

## Testing Matrix

| Area | Unit | Integration | E2E | Manual Review |
| --- | --- | --- | --- | --- |
| Dictionary validation | required | useful | no | clinical review |
| Template lifecycle | required | required | useful | publisher review |
| CDR bridge | required | required | smoke | ops review |
| Runtime forms | required | required | required | clinician review |
| Composition submission | required | required | required | CDR review |
| AQL queries | required | required | useful | report review |
| Consent/access | required | required | required | privacy review |
| Migration | required | required | useful | data review |
| Break glass | required | required | required | governance review |
| Exports | required | required | required | privacy review |

## Portability Requirements

A reusable implementation must keep these layers portable:

- dictionary object model.
- template lifecycle.
- CDR bridge interface.
- Composition mapping abstractions.
- query mapping metadata.
- consent/access decision model.
- migration source mapping model.

Deployment-specific adapters may define:

- local patient identifiers.
- site hierarchy.
- workflow queues.
- barcode behavior.
- specialty-specific dictionary packs.
- local reports.
- operational dashboards.

No portable core table, type, or service should require VCMS-specific names such as PEC or OPD.

## Example Ophthalmology Starter Pack

Reusable dictionary candidates:

- visual acuity Observation.
- intraocular pressure Observation.
- refraction Observation.
- cataract diagnosis Evaluation.
- glaucoma suspect Evaluation.
- cataract surgery referral Instruction.
- cataract surgery performed Action.
- spectacles prescription Instruction.
- spectacles dispensed Action.
- follow-up plan Instruction.
- follow-up visit Observation/Evaluation Composition.

Each candidate requires:

- archetype search/review.
- template placement.
- terminology binding.
- UCUM units where applicable.
- laterality model.
- privacy class.
- query mapping.

## Readiness Levels

```text
level_0_documented
  architecture and policies documented

level_1_connected
  CDR connectivity and EHR links working

level_2_modelled
  dictionary and templates modelled

level_3_committing
  real Compositions submitted and queried

level_4_clinical_workflow
  Instructions/Actions and patient chart working

level_5_governed
  consent, audit, migration, publication governance working

level_6_portable
  non-VCMS deployment adapter proven
```

## Completion Definition

An openEHR EMR implementation is complete enough for production pilot only when:

- clinical submissions are committed to the CDR.
- data can be queried by AQL.
- patient identity linking is governed.
- dictionary/template versions are immutable after publication.
- CDR references are stored locally.
- consent and access checks protect reads and exports.
- correction and void workflows are versioned and audited.
- migration sources preserve provenance.
- backup/restore has been tested.
- clinicians can understand and use the runtime UI.
- administrators can review audit, break-glass, templates, and mappings.
