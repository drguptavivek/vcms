import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { submitPecOpdMobileNoteSchema } from '$lib/server/modules/clinical-notes/clinical-note.schemas';
import { clinicalNoteService } from '$lib/server/modules/clinical-notes/clinical-note.service';

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: submitPecOpdMobileNoteSchema,
		privilege: 'emr.clinical_note.submit',
		resource: (body) => ({ type: 'pec', id: body.pecId }),
		rateLimit: rateLimitPolicies.sensitive,
		handler: ({ body, userId, requestId, event }) =>
			clinicalNoteService.submitPecOpdNoteWithMobileIdempotency({
				body,
				userId,
				requestId,
				ipAddress: event.locals.clientIp,
				userAgent: event.request.headers.get('user-agent') ?? undefined
			})
	});
