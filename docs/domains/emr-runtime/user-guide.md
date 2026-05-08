---
title: EMR Runtime User Guide
status: draft
owner: operations
last_reviewed: 2026-05-09
---

# EMR Runtime User Guide

## Planned Runtime Workflows

Clinical and operations users will use the runtime to:

- register or find a patient
- assign or verify a barcode
- open an encounter
- capture a draft note
- sign the note into the permanent record
- add an addendum or correction when permitted
- follow the care pathway branch selected by the system
- request a privileged pathway override with a reason when needed

## Operator Expectations

Barcode conflicts should be resolved through controlled workflows. Users should not create a second active patient record for an already-assigned barcode.

Signed notes should be treated as permanent clinical records. Corrections should be added through addendum, void, or supersede workflows rather than editing the signed note.
