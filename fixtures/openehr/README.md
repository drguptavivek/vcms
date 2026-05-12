---
title: openEHR Local Fixtures
domain: emr-runtime
status: draft
---

# openEHR Local Fixtures

These fixtures are for local EHRbase smoke testing.

- `templates/idcr-medication-list.v0.opt` is an EHRbase upstream test OPT used to verify ADL 1.4 template upload, Web Template retrieval, FLAT Composition submission, and AQL query plumbing.
- `payloads/idcr-medication-list.flat.json` is a minimal FLAT Composition payload for the template root `current_medication_list`.

Run the smoke path after `docker compose up -d`, `npm run db:push`, and `npm run seed`:

```bash
npm run ehrbase:smoke
```

The script uploads the template if needed, creates a disposable EHR with a `vcms-patient` subject namespace, submits one FLAT Composition, and confirms the Composition can be found by AQL. The output reports only identifiers and counts, not the submitted clinical payload.
