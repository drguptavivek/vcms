---
title: Terminology Security
status: draft
owner: engineering
last_reviewed: 2026-05-11
---

# Terminology Security

Terminology routes expose clinical coding metadata and must remain behind authenticated application APIs.

## Authorization

Read access uses `terminology.view`.

The privilege is currently granted to `admin` and `barcode_print_manager` because the EMR Builder is administered by those roles in the initial VCMS deployment.

## Rate Limiting

All terminology routes use `rateLimitPolicies.read`.

Search can become high-volume if tied to autocomplete. UI code should use explicit search actions or debounce before adding live autocomplete.

## Provider Boundary

The browser must call `/api/v1/terminology/**`, not public SNOMED browser endpoints and not CDR or terminology-server credentials directly.

Provider URLs, RF2 release files, and SNOMED CT credentials are server-side deployment concerns.

## Auditing

Current search and lookup routes are read-only and do not write audit events. Future publish/approve/replace terminology binding mutations must write audit records with before/after metadata and reviewer identity.
