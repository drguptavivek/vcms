---
title: Technical Documentation Index
status: active
owner: engineering
last_reviewed: 2026-05-07
---

# Technical Documentation

This directory is retained as a legacy technical index. New technical documentation should be organized by domain/blueprint under `../domains/` or as cross-cutting standards under `../standards/`.

## Current Domain Blueprints

- `../domains/barcode/index.md`: barcode lifecycle, allocation, sequence reset, reprint, offline reservation, and printing.
- `../domains/identity-access/index.md`: users, authentication, roles, ReBAC, privilege registry, and PEC allocations.
- `../domains/master-data/index.md`: teams and PEC master data.
- `../domains/observability-security/index.md`: runtime logging, SQL errors, audit logs, rate limiting, and route security.
- `../domains/printer-templates/index.md`: browser/PDF, ZPL, and EPL template configuration.

## Current Standards

- `../standards/architecture.md`: clean architecture and service-oriented module boundaries.
- `../standards/sveltekit.md`: SvelteKit conventions and project-local Svelte MCP usage.
- `../standards/tdd.md`: TDD and testing framework expectations.

## Legacy Documents

- `architecture.md`: clean architecture and module boundaries.
- `sveltekit.md`: SvelteKit route, load, form, hook, and server/client boundary conventions.
- `tdd.md`: test-driven development requirements.
- `authorization.md`: ReBAC model and TOML privilege registry.
- `security.md`: rate limiting, route security, and Spark audit gates.
- `barcode-lifecycle.md`: allocation, reprint, reserve, reset, and audit behavior.
- `printing.md`: browser/PDF, ZPL, and EPL generation.
- `observability.md`: runtime logging, SQL error logging, and audit logs.

## Maintenance Rules

- Update this index when technical docs are added, renamed, deprecated, or materially changed.
- Update YAML frontmatter metadata when reviewing or changing a document.
- Check for stale docs after code changes, especially route, API, database, authz, security, and printing changes.
