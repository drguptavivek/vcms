import { CarePathwayRepository } from './care-pathway.repository';
import type { NewCarePathway } from './care-pathway.types';

export class CarePathwayService {
	constructor(private readonly repository = new CarePathwayRepository()) {}

	create(input: NewCarePathway) {
		return this.repository.create(input);
	}
}

export const carePathwayService = new CarePathwayService();
