---
title: Vision Centre Barcode Management System
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# Vision Centre Management System

Modern management application for outreach centres and Vision Centres/Primary Eye Care Centres (PECs).

## Purpose

In its first implementation, the system generates unique barcode stickers for pre-printed OPD cards. Staff can paste pre-printed stickers on OPD cards, manually write patient demographics, and later scan the barcode for follow-up workflows. Patient linkage is planned as a future phase.

Later on the plan is to expand to include and support offline-first patient registration data capture and medical records and track patients over time including FHIR compliant bundle generation as per ABDM norms.

## Barcode Format

```text
PP-YY-SSSSSS
```

- `PP`: PEC code, left-padded to 2 digits.
- `YY`: manually selected barcode year.
- `SSSSSS`: serial number, left-padded to 6 digits.

Example:

```text
04-26-000001
```

## Planned Stack

- SvelteKit + TypeScript
- PostgreSQL
- Drizzle ORM
- Zod validation
- Better Auth
- Local ReBAC authorization using a TOML privilege registry
- Browser/PDF, ZPL, and EPL barcode printing

## Key Capabilities

- Team and PEC master management.
- User, role, and PEC allocation management.
- Barcode batch generation for allocated PECs.
- Reprint support for failed print jobs.
- Manual sequence reset/set-next-number workflows.
- Offline-issued barcode reservation/skipping.
- Configurable printer templates for browser/PDF, ZPL, and EPL.
- Runtime logs, SQL error logs, and audit logs.

## Architecture Principles

- Routes stay thin.
- Services contain business logic.
- Repositories contain database access only.
- Authorization is centralized.
- Validation is shared and schema-driven.
- Business logic is developed using TDD.
- Every API route has an explicit rate-limit policy.

## Repository Structure

```text
.plans/             Dated, folder-wise plans and implementation statuses
docs/domains/       Domain/blueprint documentation
docs/standards/     Cross-cutting engineering standards
docs/user/          User-facing documentation indexes
src/                SvelteKit application source
```

## Local Development

Database configuration is component-based in `.env`:

```powershell
DB_HOST="localhost"
DB_PORT="5400"
DB_NAME="local"
DB_USER="root"
DB_PASSWORD="mysecretpassword"
```

Docker Compose uses `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. Drizzle, the app runtime, and the seed script build their PostgreSQL connection URL from the same values.

```powershell
npm install
npm run db:start
npm run db:push
npm run seed
npm run dev
```

The repository includes `compose.yaml` for local PostgreSQL.

Open `http://localhost:5173` and sign in with the local development account:

```text
admin@example.test / ChangeMe123!
```

The local development account uses a placeholder `.env` fallback login. Replace this before production deployment.

## Validation

```powershell
npm run lint
npm run check
npm run test:unit -- --run
npm run build
```

## Dependency Maintenance

```powershell
npm run deps:check
npm run deps:update
npm run sbom
```

`deps:check` uses a short cooldown before proposing newly published package versions and filters updates through package peer dependency constraints. `sbom` writes a reproducible CycloneDX JSON SBOM to `generated/sbom.cdx.json`.

## Current Status

Working SvelteKit application scaffold with PostgreSQL, Drizzle schema, seeded PEC data, admin login fallback for local development, barcode batch generation, ZPL/EPL/browser output, ReBAC checks, rate limiting, audit logging, and initial tests.
