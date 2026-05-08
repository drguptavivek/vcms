export type EmrBuilderField = {
	id: string;
	order: number;
	[key: string]: unknown;
};

export type EmrBuilderSection = {
	id: string;
	order: number;
	fields: EmrBuilderField[];
	sections: EmrBuilderSection[];
	[key: string]: unknown;
};

export type EmrBuilderDefinition = {
	layout: {
		sections: EmrBuilderSection[];
	};
	[key: string]: unknown;
};

export type EmrBuilderSelection =
	| {
			type: 'section';
			path: string[];
			sectionId: string;
	  }
	| {
			type: 'field';
			path: string[];
			sectionId: string;
			fieldId: string;
	  };

type MoveResult<T> = {
	value: T;
	moved: boolean;
};

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function normalizeAndMove<T extends { id: string; order: number }>(
	items: T[],
	itemId: string,
	targetIndex: number
): T[] {
	const normalized = [...items]
		.map((item, index) => ({ ...item, order: index }))
		.sort((left, right) => left.order - right.order);

	const fromIndex = normalized.findIndex((item) => item.id === itemId);
	if (fromIndex === -1) {
		return normalized;
	}

	const safeTargetIndex = clamp(Math.round(targetIndex), 0, normalized.length - 1);
	const next = [...normalized];
	const [moved] = next.splice(fromIndex, 1);
	next.splice(safeTargetIndex, 0, moved);

	return next.map((item, index) => ({ ...item, order: index }));
}

function moveSectionWithinSections(
	sections: EmrBuilderSection[],
	sectionId: string,
	targetIndex: number
): MoveResult<EmrBuilderSection[]> {
	const movedSections = normalizeAndMove(sections, sectionId, targetIndex);
	return { value: movedSections, moved: movedSections !== sections };
}

function moveSectionInSectionTree(
	sections: EmrBuilderSection[],
	path: string[],
	sectionId: string,
	targetIndex: number
): MoveResult<EmrBuilderSection[]> {
	if (path.length === 0) {
		return moveSectionWithinSections(sections, sectionId, targetIndex);
	}

	const [nextSectionId, ...remainderPath] = path;
	const updatedSections = [...sections];
	const nextSectionIndex = updatedSections.findIndex((section) => section.id === nextSectionId);
	if (nextSectionIndex === -1) {
		return { value: sections, moved: false };
	}

	const nextSection = updatedSections[nextSectionIndex];
	const next = moveSectionInSectionTree(
		nextSection.sections,
		remainderPath,
		sectionId,
		targetIndex
	);
	if (!next.moved) return { value: sections, moved: false };

	updatedSections[nextSectionIndex] = { ...nextSection, sections: next.value };
	return { value: updatedSections, moved: true };
}

export function moveSectionInDefinition(
	definition: EmrBuilderDefinition,
	path: string[],
	sectionId: string,
	targetIndex: number
): EmrBuilderDefinition {
	const result = moveSectionInSectionTree(definition.layout.sections, path, sectionId, targetIndex);
	if (!result.moved) {
		return definition;
	}

	return {
		...definition,
		layout: {
			...definition.layout,
			sections: result.value
		}
	};
}

function moveFieldWithinSection(
	section: EmrBuilderSection,
	fieldId: string,
	targetIndex: number
): EmrBuilderSection {
	const fields = normalizeAndMove(section.fields, fieldId, targetIndex);
	return {
		...section,
		fields
	};
}

function moveFieldInSectionTree(
	sections: EmrBuilderSection[],
	path: string[],
	sectionId: string,
	fieldId: string,
	targetIndex: number
): MoveResult<EmrBuilderSection[]> {
	if (path.length === 0) {
		const nextSections = [...sections];
		const sectionIndex = nextSections.findIndex((section) => section.id === sectionId);
		if (sectionIndex === -1) {
			return { value: sections, moved: false };
		}

		const nextSection = moveFieldWithinSection(nextSections[sectionIndex], fieldId, targetIndex);
		nextSections[sectionIndex] = nextSection;
		return { value: nextSections, moved: true };
	}

	const [nextSectionId, ...remainderPath] = path;
	const nextSections = [...sections];
	const sectionIndex = nextSections.findIndex((section) => section.id === nextSectionId);
	if (sectionIndex === -1) {
		return { value: sections, moved: false };
	}

	const childSection = nextSections[sectionIndex];
	const next = moveFieldInSectionTree(
		childSection.sections,
		remainderPath,
		sectionId,
		fieldId,
		targetIndex
	);
	if (!next.moved) return { value: sections, moved: false };

	nextSections[sectionIndex] = {
		...childSection,
		sections: next.value
	};
	return { value: nextSections, moved: true };
}

export function moveFieldInDefinition(
	definition: EmrBuilderDefinition,
	path: string[],
	sectionId: string,
	fieldId: string,
	targetIndex: number
): EmrBuilderDefinition {
	const result = moveFieldInSectionTree(
		definition.layout.sections,
		path,
		sectionId,
		fieldId,
		targetIndex
	);
	if (!result.moved) {
		return definition;
	}

	return {
		...definition,
		layout: {
			...definition.layout,
			sections: result.value
		}
	};
}

export function canMoveItem(index: number, total: number, direction: -1 | 1) {
	return index + direction >= 0 && index + direction < total;
}

export function computeSelectionLabel(selection: EmrBuilderSelection | null): string {
	if (!selection) return 'None';
	return selection.type === 'section'
		? `Section ${selection.sectionId}`
		: `Field ${selection.sectionId} / ${selection.fieldId}`;
}

export function getSectionByPath(
	definition: EmrBuilderDefinition | null,
	path: string[],
	sectionId: string
): EmrBuilderSection | null {
	if (!definition) return null;

	let sections = definition.layout.sections;
	let current: EmrBuilderSection | null = null;
	const traversePath = path.length ? [...path] : [];
	while (traversePath.length > 0) {
		const nextId = traversePath.shift();
		const nextSection = sections.find((section) => section.id === nextId);
		if (!nextSection) return null;
		current = nextSection;
		sections = nextSection.sections;
	}

	if (current) {
		return current.id === sectionId
			? current
			: (current.sections.find((section) => section.id === sectionId) ?? null);
	}

	return sections.find((section) => section.id === sectionId) ?? null;
}

export function getField(
	definition: EmrBuilderDefinition | null,
	path: string[],
	sectionId: string,
	fieldId: string
): EmrBuilderField | null {
	if (!definition) return null;

	let sections = definition.layout.sections;
	for (const sectionId of path) {
		const nextSection = sections.find((section) => section.id === sectionId);
		if (!nextSection) return null;
		sections = nextSection.sections;
	}
	const section = sections.find((section) => section.id === sectionId);
	if (!section) return null;

	return section.fields.find((field) => field.id === fieldId) ?? null;
}

export function hasNestedSections(
	definition: EmrBuilderDefinition | null,
	path: string[]
): boolean {
	return resolveSectionChildren(definition, path).length > 0;
}

function resolveSectionChildren(definition: EmrBuilderDefinition | null, path: string[]) {
	if (!definition) return [] as EmrBuilderSection[];
	if (!path.length) return definition.layout.sections;

	let sections = definition.layout.sections;
	for (const sectionId of path) {
		const nextSection = sections.find((section) => section.id === sectionId);
		if (!nextSection) return [];
		sections = nextSection.sections;
	}

	return sections;
}

export function getSectionChildren(definition: EmrBuilderDefinition | null, path: string[]) {
	return resolveSectionChildren(definition, path);
}
