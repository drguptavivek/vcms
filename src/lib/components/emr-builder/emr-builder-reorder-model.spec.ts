import { describe, expect, it } from 'vitest';

type EmrBuilderItem = {
	id: string;
	sectionId: string;
	order: number;
};

type MoveOptions = {
	itemId: string;
	targetIndex: number;
};

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function normalizeAndMove<T extends EmrBuilderItem>(items: T[], options: MoveOptions): T[] {
	const normalized = [...items]
		.map((item, index) => ({ ...item, order: index }))
		.sort((left, right) => left.order - right.order);

	const fromIndex = normalized.findIndex((item) => item.id === options.itemId);
	if (fromIndex === -1) {
		return normalized;
	}

	const targetIndex = clamp(Math.round(options.targetIndex), 0, normalized.length - 1);
	const [moved] = normalized.splice(fromIndex, 1);
	normalized.splice(targetIndex, 0, moved);

	return normalized.map((item, index) => ({ ...item, order: index }));
}

describe('emr-builder reorder model contract', () => {
	const source = [
		{ id: 'chief_complaint', sectionId: 'history', order: 0 },
		{ id: 'visual_acuity', sectionId: 'exam', order: 1 },
		{ id: 'intraocular_pressure', sectionId: 'exam', order: 2 },
		{ id: 'diagnosis', sectionId: 'assessment', order: 3 }
	] as const;

	it('moves an item to a lower index and resequences order', () => {
		const next = normalizeAndMove([...source], { itemId: 'diagnosis', targetIndex: 1 });

		expect(next.map((item) => item.id)).toEqual([
			'chief_complaint',
			'diagnosis',
			'visual_acuity',
			'intraocular_pressure'
		]);
		expect(next.every((item, index) => item.order === index)).toBe(true);
	});

	it('moves an item to a higher index and resequences order', () => {
		const next = normalizeAndMove([...source], { itemId: 'chief_complaint', targetIndex: 2 });

		expect(next.map((item) => item.id)).toEqual([
			'visual_acuity',
			'intraocular_pressure',
			'chief_complaint',
			'diagnosis'
		]);
		expect(next.find((item) => item.id === 'chief_complaint')?.order).toBe(2);
	});

	it('keeps IDs stable after reordering', () => {
		const next = normalizeAndMove([...source], { itemId: 'visual_acuity', targetIndex: 3 });

		expect(new Set(next.map((item) => item.id)).size).toBe(source.length);
		expect(next).toHaveLength(source.length);
	});

	it('normalizes sparse or duplicate orders by recomputing sequence', () => {
		const messyItems = [
			{ id: 'a', sectionId: 'history', order: 2 },
			{ id: 'b', sectionId: 'history', order: 2 },
			{ id: 'c', sectionId: 'history', order: 8 }
		] as const;

		const next = normalizeAndMove([...messyItems], { itemId: 'c', targetIndex: 0 });

		expect(next.map((item) => item.order)).toEqual([0, 1, 2]);
	});

	it('clamps target index into valid bounds', () => {
		const belowZero = normalizeAndMove([...source], { itemId: 'diagnosis', targetIndex: -7 });
		const aboveMax = normalizeAndMove([...source], { itemId: 'diagnosis', targetIndex: 99 });

		expect(belowZero[0].id).toBe('diagnosis');
		expect(aboveMax.at(-1)?.id).toBe('diagnosis');
	});

	it.todo(
		'adds keyboard reorder intent and source/index validation after component state model is wired'
	);
});
