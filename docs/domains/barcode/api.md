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

## Manual Reset

`POST /api/v1/barcode/series/reset`

- Privilege: `barcode.sequence.reset`
- Rate limit: `sensitive`
- Requires a reason and creates an audit log.

## Manual PEC Code Skip

`POST /api/v1/barcode/ranges/reserve-offline`

- Privilege: `barcode.range.reserve_offline`
- Rate limit: `sensitive`
- Stores a PEC/year serial range that future print runs must skip.
- Dashboard use: opened from the PEC row with clear instructions, start serial, end serial, and reason.
