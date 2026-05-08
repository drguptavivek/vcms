import type { NewClinicalWorklist } from './clinical-worklist.types';
import { ClinicalWorklistRepository } from './clinical-worklist.repository';

type WorklistSourceAnswers = Record<string, unknown>;

type WorklistProjectionInput = {
	patientId: string;
	carePathwayId: string;
	sourceEncounterId: string;
	sourceClinicalNoteId: string;
	pathwayType: string;
	pathwayAnswers: WorklistSourceAnswers;
	encounterOccurredAt: Date;
	chiefComplaint?: string;
	diagnosis?: string;
	plan?: string;
	createdBy?: string;
};

const PATHWAY_FALLBACK_DUE_DAYS: Record<string, number> = {
	'emergent-referral': 1,
	'urgent-review': 2,
	'routine-follow-up': 7
};

const trueish = new Set(['1', 'true', 'y', 'yes', 'on']);

function normalizeString(value: unknown) {
	return typeof value === 'string' ? value.trim().toLowerCase() : undefined;
}

function readPositiveInt(value: unknown) {
	if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
	if (typeof value !== 'string') return undefined;
	const normalized = value.trim();
	const asNumber = Number(normalized);
	if (!Number.isInteger(asNumber) || asNumber <= 0) return undefined;
	return asNumber;
}

function readBoolean(value: unknown) {
	const normalized = normalizeString(value);
	if (!normalized) return undefined;
	return trueish.has(normalized);
}

function deriveSummary(input: {
	pathwayType: string;
	encounterOccurredAt: Date;
	pathwayAnswers: WorklistSourceAnswers;
	chiefComplaint?: string;
	diagnosis?: string;
	plan?: string;
}) {
	return {
		source: 'pec_opd',
		pathwayType: input.pathwayType,
		encounterAt: input.encounterOccurredAt.toISOString(),
		chiefComplaint: input.chiefComplaint,
		diagnosis: input.diagnosis,
		plan: input.plan,
		flags: {
			referralNeeded: readBoolean(input.pathwayAnswers.referralNeeded),
			followUpRequested: readBoolean(input.pathwayAnswers.followUpRequested),
			nextReviewRequired: readBoolean(input.pathwayAnswers.nextReviewRequired),
			riskLevel: normalizeString(input.pathwayAnswers.riskLevel)
		},
		extras: input.pathwayAnswers
	};
}

function deriveDueDate(input: {
	pathwayType: string;
	pathwayAnswers: WorklistSourceAnswers;
	occurredAt: Date;
}) {
	const explicit =
		normalizeString(input.pathwayAnswers.followUpDate) ??
		normalizeString(input.pathwayAnswers.dueDate);
	if (explicit) {
		const parsed = new Date(explicit);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed;
		}
	}

	const followUpDays = readPositiveInt(input.pathwayAnswers.followUpDays);
	if (followUpDays) {
		return new Date(input.occurredAt.getTime() + followUpDays * 24 * 60 * 60 * 1000);
	}

	const fallbackDays = PATHWAY_FALLBACK_DUE_DAYS[input.pathwayType];
	if (fallbackDays) {
		return new Date(input.occurredAt.getTime() + fallbackDays * 24 * 60 * 60 * 1000);
	}

	return undefined;
}

function deriveWorklistType(
	pathwayType: string,
	pathwayAnswers: WorklistSourceAnswers
): NewClinicalWorklist['worklistType'] | null {
	const normalizedType = normalizeString(pathwayType);
	if (!normalizedType) return null;
	if (readBoolean(pathwayAnswers.referralNeeded) || normalizedType === 'emergent-referral') {
		return 'emergency-referral';
	}
	if (normalizedType === 'urgent-review') return 'urgent-review';
	if (normalizedType === 'routine-follow-up') return 'routine-follow-up';
	return normalizedType === 'pec_opd' ? null : 'pathway-review';
}

function buildProjection(input: WorklistProjectionInput) {
	const worklistType = deriveWorklistType(input.pathwayType, input.pathwayAnswers);
	if (!worklistType) return null;

	return {
		patientId: input.patientId,
		carePathwayId: input.carePathwayId,
		sourceEncounterId: input.sourceEncounterId,
		sourceClinicalNoteId: input.sourceClinicalNoteId,
		worklistType,
		status: 'open',
		dueDate: deriveDueDate({
			pathwayType: input.pathwayType,
			pathwayAnswers: input.pathwayAnswers,
			occurredAt: input.encounterOccurredAt
		}),
		summary: deriveSummary({
			pathwayType: input.pathwayType,
			encounterOccurredAt: input.encounterOccurredAt,
			pathwayAnswers: input.pathwayAnswers,
			chiefComplaint: input.chiefComplaint,
			diagnosis: input.diagnosis,
			plan: input.plan
		}),
		createdBy: input.createdBy
	} satisfies NewClinicalWorklist;
}

export class ClinicalWorklistService {
	constructor(private readonly repository = new ClinicalWorklistRepository()) {}

	createFromPecSubmission(input: WorklistProjectionInput) {
		const projection = buildProjection(input);
		if (!projection) return Promise.resolve(null);

		return this.repository.upsert(projection).then((rows) => rows[0] ?? null);
	}
}
