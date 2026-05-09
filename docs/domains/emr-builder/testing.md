---
title: EMR Builder Testing Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-09
---

# EMR Builder Testing Blueprint

## Scope

This document focuses on test strategy and scaffolding for the **EMR Builder editor**, dictionary repository, and openEHR mapping model.

## Business Logic Tests

Use TDD for Builder definition rules. Cover:

- draft creation and editing
- field validation rules
- section composition
- pathway graph validation
- branch condition validation
- publish eligibility
- published-version immutability
- retirement rules
- dictionary asset version hashing
- openEHR mapping validation for definitions, fields, options, sections, and fragments

## Database Tests

Use PostgreSQL-backed tests for:

- version uniqueness
- published definition locking
- runtime reference protection
- draft-to-published transitions
- dictionary draft-to-published transitions
- concurrent publish attempts

## Drag/Drop UI Test Strategy (Builder UI)

The Builder UI should be tested at three levels:

1. **Model tests** (`tests/components/emr-builder/*.spec.ts`)
   - Validate deterministic ordering math before touching the DOM.
   - Keep reordering pure and deterministic in a helper-level contract:
     - move field from index A to index B,
     - recalc all `order` values to 0..n-1,
     - keep item IDs stable.
   - Include duplicate-order normalization and no-op edge cases.

2. **Component tests** (`src` + `@testing-library/svelte` once `emr-builder` component exists)
   - Render a single editor list with mocked services and test:
     - drag start/move/end state transitions,
     - local rollback on validation/network failure,
     - keyboard fallback actions,
     - "unsaved changes" state and publish button enablement.

3. **Playwright smoke** (`tests/e2e/emr-builder/*.e2e.ts`)
   - One critical path per domain change:
     - create/edit draft,
     - reorder items with pointer drag,
     - reorder fallback with keyboard,
     - verify preview and published payload update,
     - save and verify optimistic error/retry behavior.

## Component Model Tests (Current Scaffolding)

Create order/normalization tests before implementing the Svelte component. This keeps UI regressions from becoming data-shape regressions.

Recommended test targets in `tests/components/emr-builder/`:

- drag source item extraction
- insert index clamping
- in-place reorder with stable IDs
- order resequencing under ties
- dirty-state transitions (`modified`, `persisted`, `conflict`)

## Route Tests

Builder route tests must prove validation, authentication, AuthZ, rate limits, safe errors, request IDs, and audit side effects.

Dictionary route tests must additionally prove that field, option-set, and fragment assets stay behind `emr.dictionary.manage`, use mutation limits for save/publish/retire, and never copy full clinical payloads into audit logs.

## Playwright Drag Interaction Guidance

When Builder UI is available, use low-friction drag APIs:

- Prefer explicit drag handles over whole-card drag.
- Use `locator.dragTo`/`page.dragAndDrop` for pointer flows where supported.
- Always include a keyboard flow with explicit focus and move actions:
  - `ArrowUp`/`ArrowDown` to shift,
  - `Space`/`Enter` to pick/drop if using roving keyboard controls,
  - `Escape` to cancel.

For every pointer interaction test:

- assert aria-live / status text change,
- assert ordering metadata updates,
- assert order badge and target index labels,
- submit to API payload shape with updated order.

## Data-Testid Strategy

Use a stable naming convention to keep tests resilient:

- Root editor: `data-testid="emr-builder-editor"`
- Section card: `data-testid="emr-builder-section-${sectionId}"`
- Draggable item row: `data-testid="emr-builder-item-row-${itemId}"`
- Drag handle: `data-testid="emr-builder-drag-handle-${itemId}"`
- Reorder button: `data-testid="emr-builder-item-move-up|down-${itemId}"`
- Preview panel: `data-testid="emr-builder-preview"`
- Save/Publish: `data-testid="emr-builder-save"`, `data-testid="emr-builder-publish"`

Avoid using generated/visible text as test selectors for ordering assertions.

## Preview Assertions (Snapshot Independent)

Do not assert full snapshots for drag UX. Prefer semantic checks:

- section/card count in preview equals model count,
- rendered order matches `items[].order` and `items[].id`,
- field type and validation tags are visible for moved items,
- section heading text remains attached to same definition ID after reorder,
- publish payload preview mirrors list model order.

If needed, prefer element-wise JSON-like extraction over screenshots:

- `locator('[data-testid=\"emr-builder-preview\"] .row')...` map to `{ id, label, index }`
- compare this array against expected order from page model.

## Scaffold Files

Scaffolding now exists at:

- `tests/components/emr-builder/emr-builder-reorder-model.spec.ts`
- `tests/e2e/emr-builder/emr-builder-dragdrop.e2e.ts`
- `tests/fixtures/emr-builder/reorder-fixture.json`

Component and E2E specs are scaffolded with `describe.skip` so they are safe to keep in a pre-implementation state.
