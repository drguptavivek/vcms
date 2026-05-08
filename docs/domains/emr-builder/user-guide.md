---
title: EMR Builder User Guide
status: draft
owner: operations
last_reviewed: 2026-05-09
---

# EMR Builder User Guide

## Current Builder Workflow

Builder administrators can open `/emr-builder` in the authenticated app shell. The current screen is an administrative JSON-first builder for the server definition model.

Current supported workflow:

1. Enter a definition ID.
2. Load the current draft or starter metadata.
3. Edit the draft JSON.
4. Apply JSON to refresh the preview.
5. Review section/field order in the canvas.
6. Select a section or field to inspect ODK/XLSForm metadata and SNOMED metadata.
7. Move sections and fields with row buttons or keyboard arrow keys while focused.
8. Save the draft.
9. Publish when the draft is ready for runtime/mobile use.

## Administrator Expectations

Published definitions affect clinical runtime workflows and should be treated as controlled configuration. After publication, changes should be made through a new version rather than by editing the published record.

The initial Builder will be a purpose-built VCMS module and will not use SurveyJS Creator.

## ODK/XLSForm Parity Expectations

The Builder model is not XLSForm, but it should preserve the parts staff depend on:

- original XLSForm field names where available
- required/relevant/constraint/calculation/read-only semantics as safe expression metadata
- labels, help text, notes, groups, repeat-like sections, and choice sets
- external choice-source references for list data that should not be hard-coded
- SNOMED CT metadata per clinical field when known

Unsupported XLSForm semantics must remain visible in importer output or technical notes instead of being silently dropped.

## Current Limitations

- The UI is JSON-first; it does not yet provide point-and-click field creation/editing.
- Drag/drop is implemented as accessible reorder controls, not pointer drag/drop.
- Import from uploaded `.xlsx` XLSForm files is not yet a UI workflow; current importer coverage is fixture/data driven.
- Retire, rollback, clone, and rich pathway graph editing are planned but not implemented.
