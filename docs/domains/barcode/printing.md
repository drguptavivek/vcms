---
title: Barcode Printing Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# Barcode Printing Blueprint

## Output Modes

- Browser/PDF sticker sheets.
- ZPL for Zebra printers.
- EPL for Eltron/Zebra-compatible printers.

## Content Requirements

Every sticker must include:

- Machine-readable Code 128 barcode.
- Human-readable barcode text.

## Template Settings

Users can configure:

- label width
- label height
- DPI
- barcode position
- barcode height
- text position
- text size

ZPL and EPL output must convert millimetres to printer dots using the selected DPI.

## Reprint Consistency

Full range reprint and single barcode reprint must render the exact same barcode value as the original print run across browser/PDF, ZPL, and EPL.

Reprint actions only regenerate printer output. They do not allocate or advance serial numbers.
