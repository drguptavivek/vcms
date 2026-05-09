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
type ExpressionSearch = {
	value?: unknown;
	field?: string;
};
type FieldSearch = {
	id: string;
	key: string;
	label: string;
	type: string;
	fieldName?: string;
	xlsv1Name?: string;
	helpText?: string;
	guidanceHint?: string;
	appearance?: string;
	logic?: {
		required?: ExpressionSearch;
		relevance?: ExpressionSearch;
		constraint?: ExpressionSearch;
		constraintMessage?: string;
		choiceFilter?: string;
		randomizeChoices?: boolean;
		randomizeSeed?: string;
		calculation?: ExpressionSearch;
		trigger?: string;
	};
	input?: {
		barcodeInput?: boolean;
		captureAccuracy?: number;
		warningAccuracy?: number;
		rangeStart?: number;
		rangeEnd?: number;
		rangeStep?: number;
		maxPixels?: number;
		locationPriority?: string;
		locationMinInterval?: number;
		locationMaxAge?: number;
	};
	odkBind?: {
		xlsformName?: string;
		choiceSource?: string;
		choiceFilter?: string;
		relevant?: ExpressionSearch;
		constraint?: ExpressionSearch;
		constraintMessage?: string;
		parameters?: string;
		captureAccuracy?: number;
		warningAccuracy?: number;
		rangeStart?: number;
		rangeEnd?: number;
		rangeStep?: number;
		maxPixels?: number;
		locationPriority?: string;
		locationMinInterval?: number;
		locationMaxAge?: number;
		randomizeChoices?: boolean;
		randomizeSeed?: string;
		barcodeInput?: boolean;
		calculation?: ExpressionSearch;
		trigger?: string;
	};
	choiceSet?: {
		choices?: { value: string; label: string; disabled?: boolean }[];
		source?: AnyChoiceSource;
	};
};

type AnySection = {
	fields: FieldSearch[];
	sections: AnySection[];
	odk?: {
		appearance?: string;
		relevant?: string;
		repeat?: {
			count?: { value?: string };
		};
	};
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
	definition: { layout: { sections: unknown[] } },
	fieldName: string
): FieldSearch[] {
	const all = collectFields(definition.layout.sections as AnySection[]);
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

describe('XLSForm guidance and field metadata mapping', () => {
	it('preserves hints, guidance hints, constraints, relevance, and choice filters', () => {
		const result = convertXlsformToEmrDefinition({
			form: 'Guidance',
			slug: 'guidance-form',
			survey: [
				{
					type: 'integer',
					name: 'age',
					label: 'Age?',
					hint: 'Enter completed years.',
					guidance_hint: 'Ask only if needed during training.',
					constraint: '. <= 150',
					constraint_message: 'Age must be 150 or lower.'
				},
				{
					type: 'select_one yes_no',
					name: 'likes_pizza',
					label: 'Do you like pizza?'
				},
				{
					type: 'select_multiple pizza_toppings',
					name: 'favorite_topping',
					label: 'Favorite toppings',
					relevant: "${likes_pizza} = 'yes'",
					choice_filter: 'country=${country}'
				}
			],
			choices: [
				{ list_name: 'yes_no', name: 'yes', label: 'Yes' },
				{ list_name: 'yes_no', name: 'no', label: 'No' },
				{ list_name: 'pizza_toppings', name: 'cheese', label: 'Cheese' }
			],
			entities: []
		});

		const age = fieldsByName(result.definition, 'age')[0];
		const favoriteTopping = fieldsByName(result.definition, 'favorite_topping')[0];

		expect(age.helpText).toBe('Enter completed years.');
		expect(age.guidanceHint).toBe('Ask only if needed during training.');
		expect(age.logic?.constraint?.value).toBe('. <= 150');
		expect(age.logic?.constraintMessage).toBe('Age must be 150 or lower.');
		expect(favoriteTopping.logic?.relevance?.value).toBe("${likes_pizza} = 'yes'");
		expect(favoriteTopping.logic?.choiceFilter).toBe('country=${country}');
	});

	it('maps GPS, range, image, and audit parameter metadata', () => {
		const result = convertXlsformToEmrDefinition({
			form: 'Advanced types',
			slug: 'advanced-types',
			survey: [
				{
					type: 'geopoint',
					name: 'store_gps',
					label: 'Store GPS',
					parameters: 'capture-accuracy=10 warning-accuracy=20'
				},
				{
					type: 'range',
					name: 'rating',
					label: 'Rating',
					parameters: 'start=1 end=5 step=1'
				},
				{
					type: 'image',
					name: 'store_image',
					label: 'Store image',
					parameters: 'max-pixels=1024'
				},
				{
					type: 'audit',
					name: 'audit',
					label: 'Audit',
					parameters:
						'location-priority=high-accuracy location-min-interval=180 location-max-age=300'
				}
			],
			choices: [],
			entities: []
		});

		const gps = fieldsByName(result.definition, 'store_gps')[0];
		const rating = fieldsByName(result.definition, 'rating')[0];
		const image = fieldsByName(result.definition, 'store_image')[0];
		const audit = fieldsByName(result.definition, 'audit')[0];

		expect(gps.type).toBe('geopoint');
		expect(gps.input?.captureAccuracy).toBe(10);
		expect(gps.input?.warningAccuracy).toBe(20);
		expect(rating.type).toBe('range');
		expect(rating.input?.rangeStart).toBe(1);
		expect(rating.input?.rangeEnd).toBe(5);
		expect(rating.input?.rangeStep).toBe(1);
		expect(image.type).toBe('image');
		expect(image.input?.maxPixels).toBe(1024);
		expect(audit.type).toBe('audit');
		expect(audit.input?.locationPriority).toBe('high-accuracy');
		expect(audit.input?.locationMinInterval).toBe(180);
		expect(audit.input?.locationMaxAge).toBe(300);
	});

	it('preserves barcode text input and web form style metadata', () => {
		const result = convertXlsformToEmrDefinition({
			form: 'Paged form',
			slug: 'paged-form',
			form_settings: {
				form_title: 'Paged form',
				form_id: 'paged_form',
				style: 'pages'
			},
			survey: [
				{
					type: 'begin group',
					name: 'patient',
					label: 'Patient',
					appearance: 'field-list'
				},
				{
					type: 'barcode',
					name: 'patient_barcode',
					label: 'Patient barcode'
				},
				{
					type: 'end group'
				}
			],
			choices: [],
			entities: []
		});

		const barcode = fieldsByName(result.definition, 'patient_barcode')[0];
		const patientSection = result.definition.layout.sections[0]?.sections[0];

		expect(result.definition.metadata.formStyle).toBe('pages');
		expect(patientSection?.odk?.appearance).toBe('field-list');
		expect(barcode.type).toBe('text');
		expect(barcode.fieldName).toBe('patient_barcode');
		expect(barcode.input?.barcodeInput).toBe(true);
	});
});
