## Project

Vision Centre Management System: SvelteKit app - initial version for OPD barcode management

## Architecture

- Service-first, module-first, clean boundaries.
- Flow: `Route -> API/controller -> Zod -> AuthZ -> Service -> Repository -> Database`.
- Routes: transport only. No business rules. No direct repository imports.
- Services: business rules.
- Repositories: database access.
- Schemas: shared Zod validation.
- AuthZ: central ReBAC layer.
- Shared components for repeated UI, forms, panels, confirmations, previews, and validation hints.

Module shape:

```text
src/lib/server/modules/<feature>/
  <feature>.schemas.ts
  <feature>.service.ts
  <feature>.repository.ts
  <feature>.types.ts
```

## Stack

- SvelteKit, TypeScript, PostgreSQL, Drizzle, Zod.
- Better Auth for auth/session.
- Local PostgreSQL ReBAC with OpenFGA-style semantics.
- `src/lib/server/authz/privileges.toml` is the AuthZ source of truth.
- `smol-toml` for privilege registry.
- Vitest, `@testing-library/svelte`, Playwright, V8 coverage.
- Structured runtime, SQL error, and audit logging.

## Workflow

- Delegtae to  focused Spark subagents for planned bounded implementation when practical.
- Use a security-audit subagent for new/changed routes before commit.
- Use a documentation subagent for new/changed routes, workflows, and privilege-sensitive features.
- Review subagent output before considering work complete.
- Do not commit unless the user asks.
- Always run svelte.svelte-autofixer by focused Spark subagents 


## SvelteKit

- Use project Svelte MCP when available. - call via spark subagents
- delegate  svelte.svelte-autofixer to a spark subagent
- For Svelte tasks: `list-sections`, then relevant `get-documentation`.
- Run `svelte-autofixer` after Svelte edits until clean , call via spark subagents
- Run `svelte-autofixer` on every changed `.svelte` file in full. - call via spark subagents
- Use file-based routing and route groups like `(auth)` and `(app)`.
- Use `+layout.server.ts` for group auth/app-shell data.
- Use `+page.server.ts` for page data.
- Use `+server.ts` only for JSON/API endpoints.
- Prefer `/api/v1/**` for API-first workflows; use form actions only for simple progressive enhancement.
- Keep server-only code under `src/lib/server/`.
- Never import server-only modules into client-loaded code.
- Do not query DB from `.svelte`.
- Do not expose secrets, DB clients, auth internals, or repositories to client modules.
- Use typed route `$types`.
- Use `hooks.server.ts` for request context, request IDs, sessions, safe errors, and security headers.
- Server validation/AuthZ is authoritative.
- Do not mirror props into `$state` with `$effect`.
- Prefer `$derived`, form `value` defaults, `FormData`, or event handlers over one-time `$effect` initialization.

## AuthZ

- Every API mutation needs a named privilege.
- Privilege-sensitive changes need audit logs: user, action, resource, request ID, timestamp, reason, before/after.

## Route Security

- Every API route needs an explicit rate-limit policy.
- Mutations need stricter limits than reads.
- Auth, allocation, sequence reset, offline reservation, reprint, and user management need conservative limits.
- Rate-limit failures return stable `429` with request ID and safe retry guidance.
- New/changed routes need validation, AuthZ, rate limit, audit log, and safe error handling review before commit.

## Tests

- Use TDD for business logic.
- Cover allocation, reset, reservation, reprint, validation, and AuthZ.
- Bug fixes need regression tests unless no practical seam exists.
- Do not weaken tests unless wrong; document corrections.
- Prefer fast unit tests; use DB tests for transactions, locking, and concurrency.
- Use Vitest for unit/service/repository/route tests.
- Use `@testing-library/svelte` for component behavior.
- Use Playwright only for critical E2E smoke.
- Use real PostgreSQL for DB behavior tests.
- Track meaningful V8 branch coverage.

## Docs

- Plans live under dated `.plans/` folders with plan and status docs.
- Domain docs live under `docs/domains/<domain>/`.
- Domain folders include `index.md`; add `technical.md`, `user-guide.md`, `api.md`, `testing.md`, `security.md` as needed.
- Standards live in `docs/standards/`.
- User indexes live in `docs/user/`.
- Update docs for architecture, workflow, AuthZ, DB shape, or printing changes.
- All Markdown needs YAML frontmatter.
- Update indexes when files are added, renamed, deprecated, or materially changed.


## Quality

- Never expose raw SQL errors.
- Keep API errors stable and safe.
- Do not commit secrets, `.env`, local dumps, or generated build artifacts.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
