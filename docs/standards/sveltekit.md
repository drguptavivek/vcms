---
title: SvelteKit Standard
status: draft
owner: engineering
last_reviewed: 2026-05-12
---

# SvelteKit Standard

## Project-Local Svelte MCP

This repository includes a project-local Codex MCP configuration at:

```text
.codex/config.toml
```

The Svelte MCP server must be used for Svelte/SvelteKit work when available.

Required workflow:

- delegate Svelte MCP work to a focused Spark or 5.4-mini subagent
- call `list-sections` first for Svelte/SvelteKit tasks
- fetch all relevant docs with `get-documentation`
- run `svelte-autofixer` after writing or changing Svelte code
- run `svelte-autofixer` against every changed `.svelte` file in full
- iterate until Svelte MCP issues and suggestions are resolved
- if MCP tools are unavailable, state that clearly and fall back to official Svelte/SvelteKit documentation

Do not paste partial snippets into `svelte-autofixer`; use the complete changed Svelte or TypeScript file context.

## Quality Gate Delegation

`npm run check`, `npx prettier` checks, unit tests, Playwright tests, `npm run build`, Svelte MCP documentation lookup, and Svelte autofixer loops must be run by Spark or 5.4-mini subagents when those agents are available.

The coordinator reviews the subagent output, applies or integrates any required fixes, and records the commands and pass/fail status in the handoff.

## Route File Responsibilities

- `+layout.server.ts`: route-group session loading, app-shell data, and broad access checks.
- `+layout.svelte`: layout rendering only.
- `+page.server.ts`: page-specific data loading and simple form-action delegation.
- `+page.svelte`: UI rendering and user interaction only.
- `+server.ts`: JSON/API endpoint transport only.
