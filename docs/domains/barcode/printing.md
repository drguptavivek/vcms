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
