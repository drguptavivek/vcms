---
title: EMR Builder Technical Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-09
---

# EMR Builder Technical Blueprint

## Module Boundary

Builder implementation should live under:

```text
src/lib/server/modules/emr-builder/
  emr-builder.schemas.ts
  emr-builder.service.ts
  emr-builder.repository.ts
  emr-builder.types.ts
```

Builder routes may call Builder service/controller entrypoints. They must not import Builder repositories directly.

The Builder may create and publish clinical definitions. It must not mutate runtime patient records, encounters, signed notes, or executed pathway state.

## No SurveyJS Creator

The initial Builder must not use SurveyJS Creator. The administrative experience should be purpose-built for VCMS so it can enforce the project architecture, privilege registry, audit logging, validation model, and clinical immutability rules.

## Definition Model

Builder-managed definitions should be versioned. Expected definition families include:

- clinical sections
- field definitions
- validation rules
- display grouping
- note templates
- care pathway nodes
- branch conditions
- manual override policies

Draft definitions may be edited by privileged Builder users. Published definitions are immutable and are referenced by runtime records. Changes after publication require a new version.

## Runtime Contract

Runtime code consumes only published definitions through service contracts. Runtime behavior must be reproducible from the stored definition version and persisted runtime inputs.

Builder drafts, unpublished validation experiments, and retired definitions must not leak into runtime screens unless explicitly requested by a Builder administrator in a Builder context.

## XLSForm Import Coverage for PEC Forms

The current `src/lib/server/modules/xlsform-import/` implementation is fixture-driven so the four PEC XLSForm forms can be imported without the xlsx parser dependency:

- `src/lib/server/modules/xlsform-import/fixtures/pec-opd-register.json`
- `src/lib/server/modules/xlsform-import/fixtures/reported-patients-record.json`
- `src/lib/server/modules/xlsform-import/fixtures/cataract-surgery-record.json`
- `src/lib/server/modules/xlsform-import/fixtures/cataract-followup-record.json`

Each form currently maps to `EmrNoteDefinition` with section nesting (`begin_group` / `end_group`), basic field type translation, static choice metadata, and `clinical_worklist` sources for entity handoff lists.

## Unsupported XLSForm Semantics (Documented)

- **Calculation / default / instance fields**: not executed in EMR Builder; recorded as `unsupported-type` issues (`calculation`), but definition fields are intentionally omitted.
- **`relevant` expressions**: not translated to EMR visibility rules yet. Recorded as `unsupported-expression` (`group-relevant`, `relevant-expression`) on import.
- **`constraint` expressions**: numeric lower/upper bound patterns are parsed into `validation.min`/`validation.max` when possible (for simple comparisons). All other constraint logic is recorded as `unsupported-expression`.
- **`choice_filter` / dynamic filter references**: not mapped to runtime filtering yet; recorded as `unsupported-filter`.
- **Entity handoff metadata**: `entity` sheet rows map to `clinical_worklist` source metadata when available (`source_file`, `label_template`, `create_if`, `handoff`). If metadata is absent, a `unsupported-handoff` issue is raised and only best-effort defaults are used.
- **Identity and name normalization**: labels are truncated for storage safety (`label <= 200`, help text `<= 500`), and IDs are slugified/uniquified to stable `field.key` values.
- **Unsupported `select_*` variants**: unsupported or unknown field types are downgraded to `text` with an `unsupported-type` issue for manual follow-up.
