---
title: Terminology API
status: draft
owner: engineering
last_reviewed: 2026-05-11
---

# Terminology API

Terminology routes are read-only and must go through the application API. Browser code must not call CSNOFinder, Snowstorm, CSNOServ, or any public SNOMED browser API directly.

## Routes

| Route                                        | Method | Purpose                                                     |
| -------------------------------------------- | ------ | ----------------------------------------------------------- |
| `/api/v1/terminology/search?q=...&limit=...` | `GET`  | Search configured SNOMED CT provider by term or concept ID. |
| `/api/v1/terminology/lookup?conceptId=...`   | `GET`  | Fetch one SNOMED CT concept by numeric concept ID.          |
| `/api/v1/terminology/health`                 | `GET`  | Report configured provider health and browser URL metadata. |

All routes require `terminology.view` and use the shared read rate limit.

## Provider Configuration

Current provider options:

- `mock`: development-only curated concepts.
- `snowstorm`: optional Snowstorm adapter when `SNOWSTORM_BASE_URL` is configured.
- `csnoserv`: reserved for a future CSNOServ adapter.

Recommended environment variables:

```text
TERMINOLOGY_PROVIDER=mock|snowstorm|csnoserv
SNOMED_BROWSER_URL=
SNOMED_EDITION=SNOMEDCT-International
SNOMED_VERSION=
SNOMED_LANGUAGE_REFSET=
SNOWSTORM_BASE_URL=
SNOWSTORM_BRANCH=MAIN
CSNOSERV_BASE_URL=
```

## Stored Binding Metadata

When a builder user selects a SNOMED CT concept, the Builder field should preserve:

- concept ID.
- preferred term.
- fully specified name.
- semantic tag.
- active status.
- module/effective time where available.
- edition and version.
- language refset.
- provider/source service.
- binding strength.

## Failure Behavior

If the terminology provider is unavailable:

- search and lookup return stable safe API errors.
- existing fixed options and already-stored bindings remain displayable.
- new or changed terminology bindings should not be published without review.
