---
title: Master Data API Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# Master Data API Blueprint

## Teams

- `GET /api/v1/teams`
- `POST /api/v1/teams`

Creating teams requires `team.manage`.

## PECs

- `GET /api/v1/pecs`
- `POST /api/v1/pecs`

Creating PECs requires `pec.manage`. PEC codes must be numeric and between `0` and `99`.
