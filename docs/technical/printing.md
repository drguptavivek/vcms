---
title: Printing
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# Printing

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
- unit
- DPI
- barcode height
- barcode X/Y position
- text X/Y position
- text font size

ZPL and EPL output must convert millimetres to printer dots using the selected DPI.
