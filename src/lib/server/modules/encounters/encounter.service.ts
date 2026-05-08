import { EncounterRepository } from './encounter.repository';
import type { NewEncounter } from './encounter.types';

export class EncounterService {
	constructor(private readonly repository = new EncounterRepository()) {}

	create(input: NewEncounter) {
		return this.repository.create(input);
	}
}

export const encounterService = new EncounterService();
