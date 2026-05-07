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
- generate barcode batches
- reprint previous batches
- reserve or skip offline-issued ranges
- manually set/reset the next serial number

All sensitive actions require a reason and are audit-logged.

## Local Workflow

1. Sign in.
2. Open `Print Barcodes`.
3. Select PEC, year, quantity, template, and output mode.
4. Generate the batch.
5. For browser/PDF output, use browser print.
6. For ZPL/EPL output, copy the generated printer language payload to the printer integration.
7. Use `Batches` to reprint failed batches without consuming new serials.
8. Use `Reserve Offline` to skip barcodes issued outside the system.
