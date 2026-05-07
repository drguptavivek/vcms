---
title: Documentation Index
status: active
owner: engineering
last_reviewed: 2026-05-07
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

- `domains/barcode/`: PEC-centric print dashboard, barcode lifecycle, allocation, sequence reset, reprint, Manual PEC Code Skip, and printing.
- `domains/identity-access/`: users, authentication, roles, ReBAC, privilege registry, and PEC allocations.
- `domains/master-data/`: teams and PEC master data.
- `domains/observability-security/`: runtime logging, SQL errors, audit logs, rate limiting, and route security.
- `domains/printer-templates/`: browser/PDF, ZPL, and EPL template configuration.

## Standards

- `standards/architecture.md`: clean architecture and service-oriented module boundaries.
- `standards/sveltekit.md`: SvelteKit conventions and project-local Svelte MCP usage.
- `standards/tdd.md`: TDD and testing framework expectations.
