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
- Offline range reserved/skipped.
- Next serial manually reset.
- Series locked or unlocked.

## Allocation Rules

- Allocation must run inside a database transaction.
- The relevant PEC-year series row must be locked before reading or updating `next_serial`.
- Printed and reserved ranges must not overlap.
- Reprint uses existing ranges and never consumes new serials.
- All lifecycle changes must be audit-logged.
