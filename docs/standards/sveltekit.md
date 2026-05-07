---
title: SvelteKit Standard
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# SvelteKit Standard

## Project-Local Svelte MCP

This repository includes a project-local Codex MCP configuration at:

```text
.codex/config.toml
```

The Svelte MCP server must be used for Svelte/SvelteKit work when available.

Required workflow:

- call `list-sections` first for Svelte/SvelteKit tasks
- fetch all relevant docs with `get-documentation`
- run `svelte-autofixer` after writing or changing Svelte code
- iterate until Svelte MCP issues and suggestions are resolved
- if MCP tools are unavailable, state that clearly and fall back to official Svelte/SvelteKit documentation

## Route File Responsibilities

- `+layout.server.ts`: route-group session loading, app-shell data, and broad access checks.
- `+layout.svelte`: layout rendering only.
- `+page.server.ts`: page-specific data loading and simple form-action delegation.
- `+page.svelte`: UI rendering and user interaction only.
- `+server.ts`: JSON/API endpoint transport only.
