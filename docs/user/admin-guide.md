---
title: Admin Guide
status: draft
owner: operations
last_reviewed: 2026-05-07
---

# Admin Guide

## Responsibilities

Admins manage:

- teams
- PEC master records
- users
- roles
- PEC allocations for barcode print managers
- PEC and team master data
- QZ Tray direct-print integration status

Admins do not need to perform routine barcode printing unless also assigned the relevant barcode privileges.

## QZ Tray Integration

Use `Admin -> QZ Integration` to save and review QZ Tray certificate status.

The page can autogenerate a VCMS root CA, browser signing certificate, and private key, then save them directly as encrypted database records. Admins can open the manual credential form only when externally generated PEM material needs to be pasted.

The page shows compact copy/download actions for public certificate material only. Private keys are not displayed on the page.

The Root CA PEM export is public because it contains only public trust material. It is the file to place in QZ Tray as `override.crt`.

The Direct Print Signing card checks QZ Tray's local trusted-root JSON endpoint from the browser and compares the active root CA fingerprints against the VCMS Root CA fingerprint. It reports whether integration is OK, whether the VCMS Root CA is missing, or whether QZ Tray is not reachable.

If QZ Tray is not reachable, start the QZ Tray app. If the expected VCMS build is not installed, download `qz-tray.jar` from `https://github.com/drguptavivek/tray/releases`, keep it at a safe local path, and run it with `java -jar qz-tray.jar`. The release JAR is an executable fat JAR and does not require sibling `lib/` files, but it does require a local Java runtime.

The server must have `QZ_CREDENTIAL_ENCRYPTION_KEY` set before credentials can be saved, displayed, or used. For local development, `npm run qz:cert:dev` can still create PEM files for inspection, but runtime printing uses database-saved encrypted credentials only.
