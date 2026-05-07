---
title: Barcode Lifecycle
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# Barcode Lifecycle

## Format

```text
PP-YY-SSSSSS
```

Example:

```text
17-26-000001
```

## Lifecycle Events

- Series started.
- Batch printed.
- Batch reprinted.
- Offline range reserved/skipped.
- Next serial manually reset.
- Series lock state viewed. Lock/unlock is represented in the data model but not yet exposed as a user workflow.

## Allocation Rules

- Allocation must run inside a database transaction.
- The relevant PEC-year series row must be locked before reading or updating `next_serial`.
- Printed and reserved ranges must not overlap.
- Reprint uses existing ranges and never consumes new serials.
- All lifecycle changes must be audit-logged.
