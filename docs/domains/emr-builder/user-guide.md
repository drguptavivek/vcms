---
title: EMR Builder User Guide
status: draft
owner: operations
last_reviewed: 2026-05-09
---

# EMR Builder User Guide

## Current Builder Workflow

Builder administrators can open EMR Builder from the authenticated app shell. `/emr-builder` opens the Forms landing page. The left navigation includes Forms plus direct edit shortcuts for OPD Register, Reported Patients, Cataract Surgery, and Cataract Follow-up.

Current supported workflow:

1. Open `/emr-builder` to review saved Builder definitions and XLSForm-derived fixture forms.
2. Use Edit to open `/emr-builder/<definitionId>/edit`.
3. For a saved definition, load the current draft or starter metadata.
4. For a known PEC XLSForm fixture without a saved draft, load the fixture-derived definition.
5. Add sections or fields from the palette, or select an existing section or field.
6. Edit labels, column names, XLSForm names, required/read-only/hidden flags, logic expressions, validation, choices, SNOMED metadata, and localized labels/messages.
7. Use Advanced JSON for low-level edits when the point-and-click controls do not cover a field.
8. Review section/field order in the canvas and move sections or fields with accessible controls.
9. Save the draft.
10. Publish when the draft is ready for runtime/mobile use.

## Forms Landing Page

The Forms landing page lists saved Builder definitions and XLSForm-derived fixture forms. It shows form status, version, section and field counts, import notes, and runtime/mobile usage.

Use Edit to open the direct edit route for a form. Use Preview to open the same editor with `?preview=1`.

## Direct Edit Workflow

Direct edit URLs load the saved draft when present. If no saved draft exists for a known PEC XLSForm fixture, the editor loads the fixture-derived definition and Save Draft persists it into Builder storage.

Unknown definition IDs return not found.

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

- The editor supports point-and-click section and field editing for the current Builder model, with Advanced JSON available for low-level edits.
- Drag/drop remains accessible reorder controls rather than pointer drag/drop.
- Import from uploaded `.xlsx` XLSForm files is not yet a UI workflow; current importer coverage is fixture/data driven.
- Retire, rollback, clone, and rich pathway graph editing are planned but not implemented.
