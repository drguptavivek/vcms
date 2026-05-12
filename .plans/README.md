---
title: Plans Index
status: active
owner: engineering
last_reviewed: 2026-05-07
---

# Plans

This directory stores implementation plans, architecture decisions, and phase-by-phase execution notes.

## Rules

- Store plans in dated, folder-wise directories using `YYYY-MM-DD-short-topic/`.
- Each plan folder must include:
  - `plan.md`
  - `implementation-status.md`
- Keep plans decision-complete enough for another engineer or agent to implement.
- Record assumptions, chosen defaults, and rejected alternatives.
- Update the relevant plan when scope changes.
- Link technical docs from `docs/technical/` when a plan introduces or changes system design.
- Every Markdown file must include YAML frontmatter metadata.

## Initial Plans

- `2026-05-07-initial-barcode-app/plan.md`: concrete application implementation plan.
- `2026-05-07-initial-barcode-app/implementation-status.md`: implementation status for the initial barcode app plan.
- `2026-05-11-openehr-emr-platform/plan.md`: reusable openEHR-first EMR platform plan for VCMS and non-VCMS deployments.
- `2026-05-11-openehr-emr-platform/implementation-status.md`: planning status for the reusable openEHR-first EMR platform.
