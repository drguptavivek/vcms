import { describe, it } from 'vitest';

describe('runtime-first EMR contract coverage', () => {
	it.todo('submits a PEC OPD payload by upserting patient, creating encounter, branching care pathway, and signing a note');
	it.todo('stores signed clinical note corrections as new immutable versions instead of mutating prior versions');
	it.todo('maps duplicate barcode database conflicts to stable safe API errors with request IDs');
});
