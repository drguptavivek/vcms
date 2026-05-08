---
title: Barcode Printing Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# Barcode Printing Blueprint

## Output Modes

- Browser/PDF sticker sheets.
- ZPL for Zebra printers.
- EPL for Eltron/Zebra-compatible printers.

## Content Requirements

Every sticker must include:

- Machine-readable Code 128 barcode.
- Human-readable barcode text.

## Template Settings

Users can configure:

- label width
- label height
- DPI
- barcode position
- barcode height
- text position
- text size

ZPL and EPL output must convert millimetres to printer dots using the selected DPI.

## QZ Tray Direct Printing

VCMS uses QZ Tray for direct browser-to-workstation printing without placing private keys in browser-loaded code.

- The browser loads QZ Tray JavaScript and calls `configureQzSecurity` from `src/lib/qz/qz-security.ts`.
- `GET /api/v1/qz/certificate` returns the public `digital-certificate.txt` contents for `qz.security.setCertificatePromise`.
- `POST /api/v1/qz/sign` signs QZ-provided payloads with the server-only private key for `qz.security.setSignaturePromise`.
- The signing algorithm is SHA512/RSA.
- The root CA certificate/key and browser signing certificate/key are generated or saved from `Admin -> QZ Integration`.
- VCMS stores credential material as encrypted database records in `mas_settings`.
- The reversible encryption algorithm is AES-256-GCM with a per-record `scrypt` salt derived from the external master key.
- The encryption master key is `QZ_CREDENTIAL_ENCRYPTION_KEY` and must be provided by the server environment or deployment secret manager. It is never stored in the database.

Barcode workstation defaults are stored in two places:

- Browser `localStorage` under `vcms.qz.barcodeDefaults.v1`, used first because it represents the current workstation and browser profile.
- The signed-in user's `user_profiles.print_preferences_json`, used only as a fallback when this browser has no local defaults.

The saved preference payload contains the default barcode output mode (`html_pdf`, `zpl`, or `epl`), ZPL printer/template defaults, EPL printer/template defaults, and the browser print paper profile (`a4` or `a5`). Saving from the barcode dashboard updates both the browser-local copy and the user profile fallback.

The VCMS QZ Tray fork supports three trusted browser-app root CA sources:

- `authcert.override`
- app-local `override.crt`
- user-imported certificates under `~/.qz/trusted-root-certs/`

The tray menu action `Advanced -> Import trusted root CA...` validates one or more `.crt`, `.pem`, or `.cer` files, stores each certificate as `~/.qz/trusted-root-certs/<fingerprint>.crt`, and immediately reloads QZ Tray's additional root CA list without requiring a restart. `Advanced -> Paste trusted root CA PEM...` accepts the Root CA Certificate PEM from the VCMS admin page and rejects non-CA leaf certificates such as the browser Digital Certificate. `Advanced -> Trusted root CAs...` lists imported certificates with common name, organization, validity dates, fingerprint, and stored filename.

The VCMS QZ Tray fork also exposes a local read-only JSON endpoint for trust diagnostics:

- `https://localhost.qz.io:8181/trusted-root-cas`
- `http://localhost:8182/trusted-root-cas`

The endpoint returns public metadata only: built-in trust mode, trusted-root directory, active trusted root CAs, and imported root CAs with common name, organization, validity dates, fingerprint, CA flag, and stored filename/path. Web clients should prefer the HTTPS endpoint and compare the VCMS Root CA fingerprint against `activeRootCAs[].fingerprint`.

Strict deployments should enable `tray.strictmode=true`, provision only the VCMS root CA, and trust only VCMS-issued browser certificates.

The VCMS GitHub release `qz-tray.jar` is an executable fat JAR containing QZ Tray classes and bundled dependencies. It does not need sibling `lib/` files from the repository. Workstations still need a local Java runtime, normal QZ runtime data under `~/.qz/`, and browser/system trust setup for QZ Tray's local HTTPS/WSS certificate. Keep the JAR at a safe local path and run it with:

```bash
java -jar qz-tray.jar
```

Do not commit generated private keys, issued signing certificates, local keychains, or workstation-specific QZ data.

## Local Certificate Generation

For local development, generate a VCMS root CA plus a browser signing certificate:

```bash
npm run qz:cert:dev
```

The admin page can autogenerate and save QZ credentials directly. For local inspection or manual provisioning, the command writes to `.local/qz/` by default:

- `vcms-root-ca.crt`: provision this into the VCMS QZ Tray fork through `authcert.override`.
- `digital-certificate.txt`: paste this into `Admin -> QZ Integration` if not using the page autogenerate action; the browser receives this certificate.
- `private-key.pem`: paste this into `Admin -> QZ Integration` if not using the page autogenerate action; VCMS encrypts it before saving it in the database.
- `public-key.txt`: public key material for review/renewal workflows.
- `vcms-root-ca-key.pem`: local root CA private key; keep it offline and out of git.

The script refuses to overwrite an existing output directory unless `--force` is supplied:

```bash
npm run qz:cert:dev -- .local/qz --force
```

Encrypted DB storage is the runtime source of truth for QZ credentials. File paths are used only as temporary local generation output before the admin saves the credential material.

## Reprint Consistency

Full range reprint and single barcode reprint must render the exact same barcode value as the original print run across browser/PDF, ZPL, and EPL.

Reprint actions only regenerate printer output. They do not allocate or advance serial numbers.
