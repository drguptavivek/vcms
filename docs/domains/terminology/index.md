---
title: Terminology Domain
status: draft
owner: engineering
last_reviewed: 2026-05-11
---

# Terminology Domain

The Terminology domain provides server-side access to clinical terminology lookup for the EMR Builder and runtime form workflows.

SNOMED CT browsing has two separate roles:

- human browsing and review through an approved browser such as local CSNOFinder.
- structured application lookup through `/api/v1/terminology/**`.

The browser must not be the source of truth for stored bindings. The application stores selected concept metadata in the Builder definition or dictionary asset so published definitions remain reproducible.

## Current Implementation

- Read-only SNOMED CT search endpoint.
- Read-only SNOMED CT concept lookup endpoint.
- Terminology provider health endpoint.
- Development mock provider.
- Optional Snowstorm provider configuration path.
- CSNOServ provider placeholder for a governed future adapter.

## Related Documents

- `api.md`: terminology API route contract.
- `security.md`: authorization, rate limiting, and safe failure behavior.
- `../../standards/openehr-emr-implementation.md`: openEHR terminology policy and SNOMED CT browser architecture.
