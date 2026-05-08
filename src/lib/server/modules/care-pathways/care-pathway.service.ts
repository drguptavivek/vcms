import { CarePathwayRepository } from './care-pathway.repository';
import { writeAudit } from '$lib/server/observability/audit';
import { db } from '$lib/server/db';
import { PatientRepository } from '../patients/patient.repository';
import { EncounterRepository } from '../encounters/encounter.repository';
import { conflict, notFound } from '$lib/server/observability/errors';
import type { NewCarePathway } from './care-pathway.types';

type CarePathwayCreateRequest = {
	patientId: string;
	encounterId: string;
	pathwayType: string;
	parentCarePathwayId?: string;
	startedFromEncounterId?: string;
	status: NewCarePathway['status'];
	context?: NewCarePathway['context'];
	userId: string;
	requestId: string;
	ipAddress?: string;
	userAgent?: string;
};

export class CarePathwayService {
	constructor(
		private readonly repository = new CarePathwayRepository(),
		private readonly patientRepository = new PatientRepository(),
		private readonly encounterRepository = new EncounterRepository(),
		private readonly database = db,
		private readonly auditWriter = writeAudit
	) {}

	create(input: NewCarePathway) {
		return this.repository.create(input);
	}

	createForRequest(input: CarePathwayCreateRequest) {
		return this.database.transaction(async (tx) => {
			const patientRepository = new PatientRepository(tx as unknown as typeof db);
			const encounterRepository = new EncounterRepository(tx as unknown as typeof db);
			const carePathwayRepository = new CarePathwayRepository(tx as unknown as typeof db);
			const [patient, encounter] = await Promise.all([
				patientRepository.getById(input.patientId),
				encounterRepository.getById(input.encounterId)
			]);

			if (!patient) throw notFound('Patient not found.');
			if (!encounter) throw notFound('Encounter not found.');
			if (encounter.patientId !== patient.id) {
				throw conflict('Encounter does not belong to the selected patient.', {
					encounterId: input.encounterId,
					patientId: input.patientId
				});
			}

			const pathway = await carePathwayRepository.create({
				patientId: input.patientId,
				encounterId: input.encounterId,
				pathwayType: input.pathwayType,
				parentCarePathwayId: input.parentCarePathwayId,
				startedFromEncounterId: input.startedFromEncounterId,
				status: input.status,
				context: input.context ?? {},
				createdBy: input.userId
			} as NewCarePathway);

			await this.auditWriter(tx as unknown as typeof db, {
				requestId: input.requestId,
				actorUserId: input.userId,
				action: 'emr.care_pathway.create',
				resourceType: 'patient',
				resourceId: patient.id,
				after: {
					encounterId: input.encounterId,
					carePathwayId: pathway.id,
					pathwayType: pathway.pathwayType
				},
				ipAddress: input.ipAddress,
				userAgent: input.userAgent
			});

			return pathway;
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

export const carePathwayService = new CarePathwayService();
