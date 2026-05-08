---
title: Barcode API Blueprint
status: draft
owner: engineering
last_reviewed: 2026-05-07
---

# Barcode API Blueprint

## Response Envelope

Successful routes return:

```json
{
	"ok": true,
	"data": {},
	"requestId": "uuid"
}
```

Errors return:

```json
{
	"ok": false,
	"error": {
		"code": "STABLE_CODE",
		"message": "Safe user-facing message"
	},
	"requestId": "uuid"
}
```

## Batch Printing

`POST /api/v1/barcode/batches`

- Privilege: `barcode.batch.print`
- Rate limit: `barcode_mutation`
- Output: `html_pdf`, `zpl`, or `epl`
- Dashboard use: called from a PEC row with `pecId`, `year`, and `quantity`.
- Rule: the browser never supplies barcode values; the service allocates the next serial range.

## Batch History

`GET /api/v1/barcode/batches`

Returns recent print, reprint, and Manual PEC Code Skip records.

The dashboard presents these records as print runs with start serial, end serial, and quantity.

## Reprint

`POST /api/v1/barcode/batches/:id/reprint`

- Privilege: `barcode.batch.reprint`
- Rate limit: `barcode_mutation`
- Rule: regenerates output from existing ranges and never allocates new serials.

## Single Barcode Reprint

`POST /api/v1/barcode/batches/:id/reprint-one`

- Privilege: `barcode.batch.reprint`
- Rate limit: `barcode_mutation`
- Input: `serial`, `output`, optional `templateId`, and `reason`.
- Rule: serial must exist inside the original print range and no new serial is allocated.

## PEC Range Reprint

`POST /api/v1/barcode/ranges/reprint`

- Privilege: `barcode.batch.reprint`
- Rate limit: `barcode_mutation`
- Input: `pecId`, `year`, `startSerial`, `endSerial`, `output`, optional `templateId`, and `reason`.
- Rule: service validates that the full requested range exists inside previously printed ranges for that PEC/year before rendering output.

## Series

`GET /api/v1/barcode/series`

Returns current PEC/year sequence state visible to the signed-in user.

## Barcode Year Setting

`POST /api/v1/settings/barcode-year`

- Privilege: `settings.barcode_year.update`
- Rate limit: `sensitive`
- Admin-only operation exposed as `Change Years`.
- Stores the global operational barcode year in `mas_settings` under `barcode.current_year`.
- Validation: year must be between the current calendar YY and current calendar YY + 10.
- Rule: `/barcode` reads this saved setting for all PEC rows; it does not derive the operational year from January 1.

## Manual Reset

`POST /api/v1/barcode/series/reset`

- Privilege: `barcode.sequence.reset`
- Rate limit: `sensitive`
- Admin-only operation exposed as `Change Years`.
- Requires a reason and creates an audit log.

## Manual PEC Code Skip

`POST /api/v1/barcode/ranges/reserve-offline`

- Privilege: `barcode.range.reserve_offline`
- Rate limit: `sensitive`
- Stores a PEC/year serial range that future print runs must skip.
- Dashboard use: opened from the PEC row with clear instructions, start serial, end serial, and reason.

## QZ Tray Certificate

`GET /api/v1/qz/certificate`

- Access: public.
- Rate limit: `read`
- Returns the configured VCMS QZ signing certificate for browser-side `qz.security.setCertificatePromise`.
- The certificate is public material; the private key is never served to the browser.

`GET /api/v1/qz/root-ca-certificate.pem`

- Access: public.
- Rate limit: `read`
- Returns the VCMS QZ root CA certificate as a PEM file download for provisioning QZ Tray trust.
- This route exports certificate material only. It never returns the root CA private key or signing private key.

## QZ Tray Signing

`POST /api/v1/qz/sign`

- Privilege: `qz.message.sign`
- Rate limit: `qz_signing`
- Input: `toSign`, the QZ-provided payload string.
- Returns a base64 SHA512/RSA signature for browser-side `qz.security.setSignaturePromise`.
- The route reads the encrypted private key from database-backed QZ credentials and writes a success audit log for each signing operation.

## User Print Preferences

`GET /api/v1/users/profile/print-preferences`

- Privilege: `user.profile.view`
- Rate limit: `read`
- Returns the signed-in user's barcode and browser print preference fallback from `user_profiles.print_preferences_json`.

`PUT /api/v1/users/profile/print-preferences`

- Privilege: `user.profile.update`
- Rate limit: `mutation`
- Saves the signed-in user's print preference fallback.
- Input: `printPreferences` with `zpl`, `epl`, and `browserPrint` keys.
- Rule: browser `localStorage` remains the workstation source of truth; this database profile is used when local defaults are absent.

## QZ Tray Credentials

`GET /api/v1/qz/credentials`

- Privilege: `qz.credentials.update`
- Rate limit: `sensitive`
- Returns the current decrypted QZ credential material for administrative credential maintenance. The QZ Integration page itself displays only public certificate copy/download actions.

`POST /api/v1/qz/credentials`

- Privilege: `qz.credentials.update`
- Rate limit: `sensitive`
- Saves QZ credential material as encrypted database records.
- Requires a reason and creates an audit log.

`POST /api/v1/qz/credentials/generate`

- Privilege: `qz.credentials.update`
- Rate limit: `sensitive`
- Generates a VCMS root CA and browser signing certificate with OpenSSL, then saves the generated material as encrypted database records.
- Requires a reason and creates an audit log.
