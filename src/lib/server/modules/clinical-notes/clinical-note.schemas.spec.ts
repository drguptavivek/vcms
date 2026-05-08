import { describe, expect, it } from 'vitest';
import { submitPecOpdNoteSchema } from './clinical-note.schemas';

describe('clinical note validation schemas', () => {
	it('normalizes datetime payloads for encounter timing while preserving note metadata', () => {
		const parsed = submitPecOpdNoteSchema.parse({
			pecId: 1,
			barcode: '170026000001',
			patient: {
				fullName: 'Test Patient',
				ageYears: 42
			},
			encounter: {
				occurredAt: '2026-05-09T09:30:00'
			},
			pathway: {
				pathwayType: 'pec_opd',
				branchSource: 'pec_opd',
				answers: {}
			},
			note: {
				payload: { source: 'runtime' },
				chiefComplaint: 'Blurred vision',
				visualAcuity: {
					right: '6/6',
					left: '6/9'
				}
			}
		});

		expect(parsed.encounter.occurredAt).toBe('2026-05-09T09:30:00');
		expect(parsed.note.payload).toEqual({ source: 'runtime' });
	});

	it('requires encounter timestamps to include a valid time component', () => {
		expect(() =>
			submitPecOpdNoteSchema.parse({
				pecId: 1,
				barcode: '170026000001',
				patient: {
					fullName: 'Test Patient'
				},
				encounter: {
					occurredAt: '2026-05-09 09:30:00'
				},
				pathway: {
					pathwayType: 'pec_opd',
					branchSource: 'pec_opd',
					answers: {}
				},
				note: { payload: { source: 'runtime' } }
			})
		).toThrow();
	});

	it('accepts a minimal PEC OPD note submission', () => {
		const parsed = submitPecOpdNoteSchema.parse({
			pecId: 1,
			barcode: '170026000001',
			patient: {
				fullName: 'Test Patient',
				sex: 'unknown',
				ageYears: 42
			},
			pathway: {
				pathwayType: 'pec_opd',
				branchSource: 'pec_opd',
				answers: {}
			},
			note: {
				chiefComplaint: 'Blurred vision',
				payload: { source: 'runtime' }
			}
		});

		expect(parsed).toMatchObject({
			pecId: 1,
			barcode: '170026000001',
			patient: { fullName: 'Test Patient', ageYears: 42 },
			note: { chiefComplaint: 'Blurred vision', payload: { source: 'runtime' } }
		});
	});

	it('rejects empty patient names and unsupported barcode characters', () => {
		expect(() =>
			submitPecOpdNoteSchema.parse({
				pecId: 1,
				barcode: 'bad barcode',
				patient: {
					fullName: '',
					sex: 'unknown'
				},
				pathway: {
					pathwayType: 'pec_opd',
					branchSource: 'pec_opd',
					answers: {}
				},
				note: { payload: {} }
			})
		).toThrow();
	});
});

