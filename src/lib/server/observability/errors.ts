export class AppError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly status = 400,
		public readonly details?: unknown,
		public readonly headers?: Record<string, string>
	) {
		super(message);
		this.name = 'AppError';
	}
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;

export const validationFailed = (details: unknown) =>
	new AppError('VALIDATION_FAILED', 'Please correct the highlighted fields.', 400, details);

export const unauthorized = () => new AppError('UNAUTHORIZED', 'Please sign in to continue.', 401);

export const forbidden = () =>
	new AppError('FORBIDDEN', 'You do not have permission to perform this action.', 403);

export const notFound = (message = 'Requested resource was not found.') =>
	new AppError('NOT_FOUND', message, 404);

export const conflict = (message: string, details?: unknown) =>
	new AppError('CONFLICT', message, 409, details);

export const rateLimited = (retryAfterSeconds: number) =>
	new AppError(
		'RATE_LIMITED',
		'Too many requests. Please retry later.',
		429,
		{
			retryAfterSeconds
		},
		{ 'retry-after': String(retryAfterSeconds) }
	);
