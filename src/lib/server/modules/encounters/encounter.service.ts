import { EncounterRepository } from './encounter.repository';
import { writeAudit } from '$lib/server/observability/audit';
import { db } from '$lib/server/db';
import { PatientRepository } from '../patients/patient.repository';
import { notFound } from '$lib/server/observability/errors';
import type { NewEncounter } from './encounter.types';

type CreateEncounterInput = {
	patientId?: string;
	patientBarcode?: string;
	pecId: number;
	barcodeSnapshot?: string;
	status: NewEncounter['status'];
	occurredAt?: string;
	userId: string;
	requestId: string;
	ipAddress?: string;
	userAgent?: string;
};

export class EncounterService {
	constructor(
		private readonly repository = new EncounterRepository(),
		private readonly patientRepository = new PatientRepository(),
		private readonly database = db,
		private readonly auditWriter = writeAudit
	) {}

	create(input: NewEncounter) {
		return this.repository.create(input);
	}

	createForRequest(input: CreateEncounterInput) {
		return this.database.transaction(async (tx) => {
			const patientRepository = new PatientRepository(tx as unknown as typeof db);
			const encounterRepository = new EncounterRepository(tx as unknown as typeof db);
			const patient = input.patientId
				? await patientRepository.getById(input.patientId)
				: await patientRepository.findByBarcode(input.patientBarcode ?? '');

			if (!patient) throw notFound('Patient not found.');

			const barcodeSnapshot = input.barcodeSnapshot ?? patient.barcode;
			const encounter = await encounterRepository.create({
				patientId: patient.id,
				pecId: input.pecId,
				barcodeSnapshot,
				status: input.status,
				occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
				createdBy: input.userId
			} as NewEncounter);

			await this.auditWriter(tx as unknown as typeof db, {
				requestId: input.requestId,
				actorUserId: input.userId,
				action: 'emr.encounter.create',
				resourceType: 'patient',
				resourceId: patient.id,
				after: {
					encounterId: encounter.id,
					patientId: patient.id,
					pecId: input.pecId,
					barcodeSnapshot,
					status: encounter.status
				},
				ipAddress: input.ipAddress,
				userAgent: input.userAgent
			});

			return encounter;
		});
	}

	listByPatientId(patientId: string) {
		return this.repository.listByPatientId(patientId);
	}

	async listByPatientIdentifier(input: { patientId?: string; patientBarcode?: string }) {
		const patientId = input.patientId
			? input.patientId
			: await this.patientRepository
					.findByBarcode(input.patientBarcode ?? '')
					.then((patient) => patient?.id);

		if (!patientId) throw notFound('Patient not found.');

		return this.repository.listByPatientId(patientId);
	}
}

export const encounterService = new EncounterService();
