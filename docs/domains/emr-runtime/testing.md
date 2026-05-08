---
title: EMR Runtime Testing Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-09
---

# EMR Runtime Testing Blueprint

## Business Logic Tests

Use TDD for runtime business rules. Cover:

- barcode uniqueness and safe duplicate errors
- draft note editability
- signed note immutability
- addendum, void, and supersede lineage
- care pathway branch evaluation
- pathway override reason requirements

## Database Tests

Use PostgreSQL-backed tests for:

- active barcode uniqueness constraints
- concurrent barcode assignment
- transactional note signing
- immutable signed-note enforcement
- published pathway version references

## Route Tests

Runtime route tests must prove validation, authentication, AuthZ, rate limits, safe errors, request IDs, and audit side effects.

## Component And E2E Tests

Use `@testing-library/svelte` for clinician note capture, validation hints, pathway branch display, and correction confirmations.

Use Playwright only for critical smoke workflows: patient registration, barcode lookup, note signing, and pathway branch execution.
