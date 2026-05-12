import { createHash } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { AppError } from '$lib/server/observability/errors';
import type { Patient } from '../patients/patient.types';
import type { PatientRepository } from '../patients/patient.repository';
import { ehrbaseClient, type EhrbaseClient } from './ehrbase.client';
import type { OpenEhrCompositionReference } from './ehrbase.types';

type RuntimeCompositionInput = {
	patient: Patient;
	occurredAt: Date;
	note: {
		chiefComplaint?: string;
		visualAcuity?: Record<string, unknown>;
		diagnosis?: string;
		plan?: string;
		payload: Record<string, unknown>;
	};
	userId: string;
	userDisplayName?: string;
	patientRepository: PatientRepository;
};

type RuntimeCompositionResult = {
	reference: OpenEhrCompositionReference;
	flatPayloadHash: string;
	localPayloadHash: string;
};

function privateEnv(name: string) {
	return env[name] ?? process.env[name];
}

function configuredSubjectNamespace() {
	return privateEnv('EHRBASE_SUBJECT_NAMESPACE')?.trim() || 'vcms-patient';
}

function configuredDefaultTemplateId() {
	return privateEnv('EHRBASE_DEFAULT_TEMPLATE_ID')?.trim() || undefined;
}

function configuredDefaultCompositionPrefix(templateId: string) {
	return privateEnv('EHRBASE_DEFAULT_COMPOSITION_PREFIX')?.trim() || templateId;
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function asString(value: unknown) {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function toCanonicalJson(value: unknown): unknown {
	if (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	) {
		return value;
	}

	if (Array.isArray(value)) return value.map((entry) => toCanonicalJson(entry));

	if (typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([, entry]) => entry !== undefined)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, toCanonicalJson(entry)])
		);
	}

	return value;
}

function sha256Json(value: unknown) {
	return createHash('sha256')
		.update(JSON.stringify(toCanonicalJson(value)))
		.digest('hex');
}

function isFlatPath(key: string) {
	return key.includes('/') || key.includes('|');
}

function buildFlatPayload(
	note: RuntimeCompositionInput['note'],
	occurredAt: Date
): { templateId: string; payload: Record<string, unknown> } {
	const payload = asRecord(note.payload);
	const openEhr = asRecord(payload.openEhr);
	const templateId = asString(openEhr.templateId) ?? configuredDefaultTemplateId();
	if (!templateId) {
		throw new AppError(
			'OPENEHR_TEMPLATE_REQUIRED',
			'Published openEHR template mapping is required before saving clinical data.',
			409
		);
	}

	const explicitFlat = asRecord(openEhr.flat);
	const source = Object.keys(explicitFlat).length ? explicitFlat : payload;
	const flatPayload = Object.fromEntries(
		Object.entries(source).filter(([key, value]) => isFlatPath(key) && value !== undefined)
	);

	if (!Object.keys(flatPayload).length) {
		throw new AppError(
			'OPENEHR_FLAT_PAYLOAD_REQUIRED',
			'Clinical payload must contain Web Template flat paths before it can be saved.',
			409,
			{ templateId }
		);
	}

	const compositionPrefix =
		asString(openEhr.compositionPrefix) ?? configuredDefaultCompositionPrefix(templateId);
	const withContext = {
		...flatPayload,
		[`${compositionPrefix}/context/start_time`]:
			flatPayload[`${compositionPrefix}/context/start_time`] ?? occurredAt.toISOString(),
		[`${compositionPrefix}/category|code`]:
			flatPayload[`${compositionPrefix}/category|code`] ?? '433',
		[`${compositionPrefix}/category|value`]:
			flatPayload[`${compositionPrefix}/category|value`] ?? 'event',
		[`${compositionPrefix}/category|terminology`]:
			flatPayload[`${compositionPrefix}/category|terminology`] ?? 'openehr'
	};

	return { templateId, payload: withContext };
}

export class EhrCompositionService {
	constructor(private readonly client: EhrbaseClient = ehrbaseClient) {}

	async submitRuntimeComposition(
		input: RuntimeCompositionInput
	): Promise<RuntimeCompositionResult> {
		const flat = buildFlatPayload(input.note, input.occurredAt);
		const subjectNamespace = input.patient.openEhrSubjectNamespace ?? configuredSubjectNamespace();
		const subjectId = input.patient.openEhrSubjectId ?? input.patient.id;
		const ehrId =
			input.patient.openEhrId ??
			(
				await this.client.createEhr({
					subjectId,
					subjectNamespace
				})
			).ehrId;

		if (!input.patient.openEhrId) {
			await input.patientRepository.updateOpenEhrIdentity(input.patient.id, {
				openEhrId: ehrId,
				openEhrSubjectId: subjectId,
				openEhrSubjectNamespace: subjectNamespace
			});
		}

		const composition = await this.client.submitFlatComposition({
			ehrId,
			templateId: flat.templateId,
			committerName: input.userDisplayName ?? input.userId,
			committerId: input.userId,
			payload: flat.payload
		});

		return {
			reference: composition,
			flatPayloadHash: sha256Json(flat.payload),
			localPayloadHash: sha256Json(input.note)
		};
	}
}

export const ehrCompositionService = new EhrCompositionService();
