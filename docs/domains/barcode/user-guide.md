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
- generate the next barcode range for a PEC
- reprint a selected start/end serial range from a PEC row
- print a previous print run again
- print one barcode from a previous range
- save a Manual PEC Code Skip from the PEC row
- manually set/reset the next serial number

All sensitive actions require a reason and are audit-logged.

## Local Workflow

1. Sign in.
2. Open `Print Barcodes`.
3. Select barcode year if you are an admin, then choose optional PEC search, template, and output mode.
4. Review each PEC row for last generated barcode and next barcode.
5. Enter a quantity against the PEC row and generate the next barcode range.
6. Use `Manual PEC Code Skip` on the PEC row when serials were manually issued, damaged, lost, or otherwise should be skipped.
7. If a skip-history icon appears next to `Manual PEC Code Skip`, open it to review preserved skipped ranges for that PEC/year.
8. Use `Reprint` on the PEC row to enter a start and end serial for reprinting; the system validates that the range was printed earlier.
9. Use `Recent Print Runs` to open the same two-panel reprint row: `Range` for start/end serials or `Single` for one serial.
10. Review the live formatted barcode preview before clicking `Print Range` or `Print Single`.

The visible “print run” record is operationally a start serial, end serial, and quantity. The system stores an internal batch identifier so audits and reprints can point to the exact original print event.
