---
title: Barcode Print Manager Guide
status: draft
owner: operations
last_reviewed: 2026-05-07
---

# Barcode Print Manager Guide

## Responsibilities

Barcode print managers can work only with PECs allocated to them.

They can:

- view the next barcode number for an allocated PEC/year
- generate the next start/end serial range from a PEC row
- print previous ranges again
- print one barcode from a previous range
- save a Manual PEC Code Skip from a PEC row

All sensitive actions require a reason and are audit-logged.

Use `Print Barcodes` as the main dashboard. Search by PEC, then use the action controls against the relevant PEC. Generate, PEC range reprint, Recent Print Run range reprint, and Print One all open a confirmation row before printer output is created. Only admins can use `Change Years` to update the saved operational barcode year for all PECs or set/reset next serials. Use `Manual PEC Code Skip` when serials were manually issued, damaged, lost, or otherwise should not be generated again.

Use `Set Default Printer` on the dashboard to save workstation print defaults. The browser-local setting is used first for this machine. The same values are copied to your VCMS user profile so they can be restored automatically when you use a browser profile that does not yet have local defaults. You can save the default barcode output mode, separate ZPL/EPL printer and template defaults, and browser A4/A5 print preference.

## Barcode Rules

- Format: `PP-YY-SSSSSS`.
- `PP`: 2-digit PEC code.
- `YY`: manual operational barcode year.
- `SSSSSS`: 6-digit serial.
- Example: PEC `4`, year `26`, serial `1` -> `04-26-000001`.
- Browser/PDF, ZPL, and EPL must use the same barcode value.
- Output must include machine-readable barcode and human-readable text.
- Barcode year is an operational DB setting, not calendar-derived.
- Series reset is manual and privileged.
- Use transactions and row-level locking for allocation.
- Never generate duplicate barcode values.
