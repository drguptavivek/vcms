type ApiEnvelope<T> =
	| { ok: true; data: T; requestId: string }
	| { ok: false; error: { code: string; message: string }; requestId: string };

type QzSecurityApi = {
	security: {
		setCertificatePromise: (
			handler: () => Promise<string>,
			options?: { rejectOnFailure: boolean }
		) => void;
		setSignatureAlgorithm: (algorithm: 'SHA512') => void;
		setSignaturePromise: (handler: (toSign: string) => Promise<string>) => void;
	};
};

type QzSecurityOptions = {
	certificateUrl?: string;
	signUrl?: string;
};

export function configureQzSecurity(qz: QzSecurityApi, options: QzSecurityOptions = {}) {
	const certificateUrl = options.certificateUrl ?? '/api/v1/qz/certificate';
	const signUrl = options.signUrl ?? '/api/v1/qz/sign';

	qz.security.setCertificatePromise(
		async () => {
			const data = await readApiData<{ certificate: string }>(
				await fetch(certificateUrl, {
					cache: 'no-store',
					credentials: 'same-origin'
				})
			);
			return data.certificate;
		},
		{ rejectOnFailure: true }
	);

	qz.security.setSignatureAlgorithm('SHA512');
	qz.security.setSignaturePromise(async (toSign) => {
		const data = await readApiData<{ signature: string }>(
			await fetch(signUrl, {
				method: 'POST',
				cache: 'no-store',
				credentials: 'same-origin',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ toSign })
			})
		);
		return data.signature;
	});
}

async function readApiData<T>(response: Response) {
	const payload = (await response.json()) as ApiEnvelope<T>;
	if (!response.ok || !payload.ok) {
		const message = payload.ok === false ? payload.error.message : 'QZ integration request failed.';
		throw new Error(message);
	}
	return payload.data;
}
