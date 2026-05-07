---
title: Identity And Access API Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# Identity And Access API Blueprint

## Users

- `GET /api/v1/users`
- `GET /api/v1/users/roles`
- `POST /api/v1/users/roles`
- `POST /api/v1/users/pec-allocations`

All user-management routes require `user.manage`.

## PEC Allocation

`POST /api/v1/users/pec-allocations`

Request:

```json
{
	"userId": "user-id",
	"pecId": 1
}
```

Creates or reactivates a user-to-PEC allocation relationship.

## Local Development Login

The local development seed creates:

```text
admin@example.test / ChangeMe123!
```

When `DEV_LOGIN_ENABLED=true`, the login page can use this placeholder account through a development-only cookie fallback. This is for local development only and must not be used as the production authentication path.
