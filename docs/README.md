---
title: Documentation Index
status: active
owner: engineering
last_reviewed: 2026-05-09
---

# Documentation

Documentation is split into technical documentation and user-facing documentation.

```text
docs/domains/     Domain/blueprint documentation
docs/standards/   Cross-cutting engineering standards
docs/user/        Cross-domain user-facing indexes and guides
```

Update documentation whenever implementation changes behavior, workflows, architecture, authorization, printing, or operational expectations.

## Documentation Maintenance Rules

- Every Markdown file must include YAML frontmatter metadata.
- Documentation subagents must update this index when docs are added, renamed, deprecated, or materially changed.
- Documentation subagents must check for stale technical and user-facing docs after code changes.
- Documentation subagents must update `last_reviewed` metadata on reviewed documents.

## Domain Blueprints

- `domains/barcode/`: PEC-centric print dashboard, barcode lifecycle, allocation, sequence reset, reprint, Manual PEC Code Skip, and direct printing.
- `domains/emr-builder/`: Forms landing page, direct edit workflow for PEC imported forms, versioned clinical definitions, validation rules, publication, and retirement planning.
- `domains/emr-runtime/`: runtime-first EMR patient registration, barcode identity, encounters, immutable notes, addenda, care pathway branching, and offline staff mobile collection planning.
- `domains/identity-access/`: users, authentication, roles, ReBAC, privilege registry, and PEC allocations.
- `domains/master-data/`: teams and PEC master data.
- `domains/observability-security/`: runtime logging, SQL errors, audit logs, rate limiting, and route security.
- `domains/printer-templates/`: browser/PDF, ZPL, and EPL template configuration.
- `domains/terminology/`: SNOMED CT search, concept lookup, provider configuration, and terminology-browser boundary.

## Standards

- `standards/architecture.md`: clean architecture and service-oriented module boundaries.
- `standards/openehr-emr-implementation.md`: portable openEHR EMR architecture for dictionary, templates, Compositions, AQL, consent, migration, and EHRbase-style CDR integration.
- `standards/sveltekit.md`: SvelteKit conventions and project-local Svelte MCP usage.
- `standards/tdd.md`: TDD and testing framework expectations.

## User Guides

- `user/admin-guide.md`: admin responsibilities, including QZ Tray integration status review.
