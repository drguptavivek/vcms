import { describe, expect, it } from 'vitest';

import {
	computeSelectionLabel,
	moveFieldInDefinition,
	moveSectionInDefinition,
	normalizeAndMove
} from './emr-builder-reorder-model';

describe('emr-builder reorder model contract', () => {
	const source = [
		{ id: 'chief_complaint', order: 0 },
		{ id: 'visual_acuity', order: 1 },
		{ id: 'intraocular_pressure', order: 2 },
		{ id: 'diagnosis', order: 3 }
	] as const;

	it('moves an item to a lower index and resequences order', () => {
		const next = normalizeAndMove([...source], 'diagnosis', 1);

		expect(next.map((item) => item.id)).toEqual([
			'chief_complaint',
			'diagnosis',
			'visual_acuity',
			'intraocular_pressure'
		]);
		expect(next.every((item, index) => item.order === index)).toBe(true);
	});

	it('moves an item to a higher index and resequences order', () => {
		const next = normalizeAndMove([...source], 'chief_complaint', 2);

		expect(next.map((item) => item.id)).toEqual([
			'visual_acuity',
			'intraocular_pressure',
			'chief_complaint',
			'diagnosis'
		]);
		expect(next.find((item) => item.id === 'chief_complaint')?.order).toBe(2);
	});

	it('keeps IDs stable after reordering', () => {
		const next = normalizeAndMove([...source], 'visual_acuity', 3);

		expect(new Set(next.map((item) => item.id)).size).toBe(source.length);
		expect(next).toHaveLength(source.length);
	});

	it('normalizes sparse or duplicate orders by recomputing sequence', () => {
		const messyItems = [
			{ id: 'a', order: 2 },
			{ id: 'b', order: 2 },
			{ id: 'c', order: 8 }
		] as const;

		const next = normalizeAndMove([...messyItems], 'c', 0);

		expect(next.map((item) => item.order)).toEqual([0, 1, 2]);
	});

	it('clamps target index into valid bounds', () => {
		const belowZero = normalizeAndMove([...source], 'diagnosis', -7);
		const aboveMax = normalizeAndMove([...source], 'diagnosis', 99);

		expect(belowZero[0].id).toBe('diagnosis');
		expect(aboveMax.at(-1)?.id).toBe('diagnosis');
	});

	it('moves nested sections by parent section path', () => {
		const definition = {
			layout: {
				sections: [
					{
						id: 'history',
						order: 0,
						fields: [],
						sections: [
							{
								id: 'history_intro',
								order: 0,
								fields: [],
								sections: []
							},
							{
								id: 'history_detail',
								order: 1,
								fields: [],
								sections: []
							}
						]
					},
					{
						id: 'exam',
						order: 1,
						fields: [],
						sections: []
					}
				]
			}
		} as const;

		const moved = moveSectionInDefinition(definition as any, ['history'], 'history_intro', 1);

		expect(moved.layout.sections[0].sections.map((section) => section.id)).toEqual([
			'history_detail',
			'history_intro'
		]);
	});

	it('moves fields inside the right section path', () => {
		const definition = {
			layout: {
				sections: [
					{
						id: 'history',
						order: 0,
						sections: [
							{
								id: 'history_repeat',
								order: 0,
								fields: [
									{ id: 'a', order: 0 },
									{ id: 'b', order: 1 },
									{ id: 'c', order: 2 }
								],
								sections: []
							}
						],
						fields: []
					}
				]
			}
		} as const;

		const moved = moveFieldInDefinition(definition as any, ['history'], 'history_repeat', 'c', 0);

		expect(moved.layout.sections[0].sections[0].fields.map((field) => field.id)).toEqual([
			'c',
			'a',
			'b'
		]);
	});

	it('supports inspector label rendering', () => {
		expect(
			computeSelectionLabel({
				type: 'field',
				path: ['history'],
				sectionId: 'history_intro',
				fieldId: 'chief_complaint'
			})
		).toBe('Field history_intro / chief_complaint');
	});
});
