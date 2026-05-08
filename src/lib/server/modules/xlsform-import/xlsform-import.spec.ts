import { describe, expect, it } from 'vitest';
import { convertXlsformToEmrDefinition } from './xlsform-import';
import type { XlsformFixture } from './xlsform-import.types';
import {
	PEC_XLSFORMS,
	cataractFollowupRecordFixture,
	cataractSurgeryRecordFixture,
	pecOpdRegisterFixture,
	reportedPatientsRecordFixture
} from './fixtures/index';

type AnyChoiceSource = {
	kind?: string;
	name?: string;
	filter?: Record<string, unknown>;
};
type FieldSearch = {
	id: string;
	key: string;
	label: string;
	type: string;
	xlsv1Name?: string;
	odkBind?: { xlsformName?: string; choiceSource?: string };
	choiceSet?: {
		choices?: { value: string; label: string; disabled?: boolean }[];
		source?: AnyChoiceSource;
	};
};

type AnySection = {
	fields: FieldSearch[];
	sections: AnySection[];
};

function collectFields(fields: AnySection[]): FieldSearch[] {
	const all: FieldSearch[] = [];
	for (const section of fields) {
		all.push(...section.fields);
		if (section.sections.length > 0) {
			all.push(...collectFields(section.sections));
		}
	}
	return all;
}

function fieldsByName(
	definition: { layout: { sections: AnySection[] } },
	fieldName: string
): FieldSearch[] {
	const all = collectFields(definition.layout.sections);
	return all.filter((entry) => entry.xlsv1Name === fieldName);
}

function sectionNames(definition: {
	layout: { sections: Array<{ title: string; sections?: { title: string }[] }> };
}): string[] {
	return definition.layout.sections.flatMap((section) => [
		(section.title as string) || '',
		...(section.sections ?? []).map((sub) => sub.title)
	]);
}

describe('PEC XLSForm fixture mapping', () => {
	it('maps all four PEC fixtures into valid EMR definitions', () => {
		for (const form of PEC_XLSFORMS) {
			const result = convertXlsformToEmrDefinition(form as XlsformFixture);
			expect(result.definitionId).toBe(form.slug);
			expect(result.definition.metadata.tags).toContain('xlsform-import');
			expect(result.definition.layout.sections).toHaveLength(1);
			expect(result.definition.metadata.version).toBeGreaterThan(0);
		}
	});

	it('maps static-choice and entity handoff sources for PEC OPD', () => {
		const result = convertXlsformToEmrDefinition(pecOpdRegisterFixture);
		const pecField = fieldsByName(result.definition, 'pec')[0];
		const clusterField = fieldsByName(result.definition, 'Cluster')[0];

		expect(pecField.type).toBe('single_choice');
		expect(clusterField.choiceSet?.source).toBeUndefined();
		expect(clusterField.choiceSet?.choices?.length).toBeGreaterThan(5);

		expect(sectionNames(result.definition)).toEqual(
			expect.arrayContaining(['Disability Questionnaire', 'Refraction Details of Patient'])
		);
	});

	it('captures clinical_worklist handoff metadata in reported-patients form', () => {
		const result = convertXlsformToEmrDefinition(reportedPatientsRecordFixture);
		const referred1 = fieldsByName(result.definition, 'Referred1')[0];
		const referred2 = fieldsByName(result.definition, 'Referred2')[0];

		expect(referred1.type).toBe('single_choice');
		expect(referred1.choiceSet?.source).toMatchObject({
			kind: 'clinical_worklist',
			filter: expect.objectContaining({
				create_if: '${admitForSx}=1'
			})
		});
		expect(referred2.choiceSet?.source).toMatchObject({
			kind: 'clinical_worklist',
			filter: expect.objectContaining({
				create_if: '${admitForSx}=1'
			})
		});
		expect(referred1.choiceSet?.source?.filter?.source_file).toContain('ReferredList');
		expect(referred2.choiceSet?.source?.filter?.source_file).toContain('ReferredList');
	});

	it('captures clinical_worklist handoff metadata in cataract surgery form', () => {
		const result = convertXlsformToEmrDefinition(cataractSurgeryRecordFixture);
		const admit = fieldsByName(result.definition, 'admit')[0];

		expect(admit.type).toBe('single_choice');
		expect(admit.choiceSet?.source).toMatchObject({
			kind: 'clinical_worklist',
			name: 'cataract-surgery-record-admitlist',
			filter: expect.objectContaining({
				create_if: '${sxDone}=1'
			})
		});
	});

	it('captures repeated ODK handoff list source for cataract follow-up', () => {
		const result = convertXlsformToEmrDefinition(cataractFollowupRecordFixture);
		const followup1 = fieldsByName(result.definition, 'Followup1')[0];
		const followup2 = fieldsByName(result.definition, 'Followup2')[0];

		expect(followup1.choiceSet?.source?.kind).toBe('clinical_worklist');
		expect(followup2.choiceSet?.source?.kind).toBe('clinical_worklist');
		expect(followup1.choiceSet?.source?.filter?.source_file).toContain('SurgeryList');
		expect(followup2.choiceSet?.source?.filter?.source_file).toContain('SurgeryList');
		expect(followup1.choiceSet?.source?.name).toBe('cataract-followup-record-surgerylist');
		expect(followup2.choiceSet?.source?.name).toBe('cataract-followup-record-surgerylist');
	});
});
