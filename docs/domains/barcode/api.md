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

## Batch History

`GET /api/v1/barcode/batches`

Returns recent print, reprint, and offline reservation batches.

## Reprint

`POST /api/v1/barcode/batches/:id/reprint`

- Privilege: `barcode.batch.reprint`
- Rate limit: `barcode_mutation`
- Rule: regenerates output from existing ranges and never allocates new serials.

## Series

`GET /api/v1/barcode/series`

Returns current PEC/year sequence state visible to the signed-in user.

## Manual Reset

`POST /api/v1/barcode/series/reset`

- Privilege: `barcode.sequence.reset`
- Rate limit: `sensitive`
- Requires a reason and creates an audit log.

## Offline Reservation

`POST /api/v1/barcode/ranges/reserve-offline`

- Privilege: `barcode.range.reserve_offline`
- Rate limit: `sensitive`
- Reserves an offline-issued range so future print batches skip those serials.
