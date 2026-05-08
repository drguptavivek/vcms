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
