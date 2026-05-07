---
title: Authorization
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# Authorization

## Model

Authorization uses a local ReBAC checker with OpenFGA-style relationship semantics.

## Central Registry

Privileges are defined in a TOML file:

```text
src/lib/server/authz/privileges.toml
```

The registry is the authoritative list of allowed application actions.

## Relationship Examples

```text
user has_role admin
user has_role barcode_print_manager
user allocated_to pec
pec belongs_to team
```

## Enforcement

Every API mutation must call the authorization layer with:

- user
- privilege/action
- resource type
- resource id

Barcode print managers may only operate on PECs explicitly allocated to them.

## Route Authorization Gate

New or changed routes must not be considered complete until a dedicated Spark security-audit subagent confirms:

- the route uses a named privilege from the TOML registry when required
- the route checks the correct resource scope
- barcode print managers are limited to allocated PECs
- failed authorization attempts are logged safely
- errors returned to users do not reveal sensitive internals
