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
- manually set/reset the next serial number

All sensitive actions require a reason and are audit-logged.

Use `Print Barcodes` as the main dashboard. Search by PEC, confirm the selected barcode year, then use the action controls against the relevant PEC. Generate, PEC range reprint, Recent Print Run range reprint, and Print One all open a confirmation row before printer output is created. Only admins can change the dashboard barcode year, and that selected year applies to all PEC rows. Use `Manual PEC Code Skip` when serials were manually issued, damaged, lost, or otherwise should not be generated again.
