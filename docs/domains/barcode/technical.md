---
title: Barcode Domain Technical Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# Barcode Domain Technical Blueprint

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
- Single barcode reprinted.
- Manual PEC Code Skip saved.
- The current operational barcode year is stored in `mas_settings` as `barcode.current_year`.
- Admins change the operational barcode year manually; it must not automatically roll over on January 1.
- Next serial manually reset.
- Series lock state viewed. Lock/unlock is represented in the data model but not yet exposed as a user workflow.

## Allocation Rules

- Allocation must run inside a database transaction.
- The relevant PEC-year series row must be locked before reading or updating `next_serial`.
- Printed and reserved ranges must not overlap.
- Reprint uses existing ranges and never consumes new serials.
- Single barcode reprint must verify that the requested serial belongs to the original print range.
- The PEC dashboard is scoped to PECs allocated to the signed-in user.
- Manual PEC Code Skip is a PEC-scoped mutation and must prevent overlaps before moving the next serial forward.
- All lifecycle changes must be audit-logged.

## Print Run Model

Operators think in ranges: start serial, end serial, and quantity.

The database still stores a batch record for every print, Manual PEC Code Skip, and reprint because it gives audit logs and reprint actions a stable source event.
