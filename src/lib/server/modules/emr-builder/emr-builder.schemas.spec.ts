import { describe, expect, it } from 'vitest';
import {
	computeEmrNoteDefinitionVersionHash,
	emrNoteDefinitionSchema,
	parseEmrNoteDefinition,
	emrBuilderDefinitionQuerySchema,
	emrBuilderPublishDraftSchema,
	emrBuilderSaveDraftSchema
} from './emr-builder.schemas';

const baseDefinition = {
	metadata: {
		definitionId: 'opd-eye-note',
		slug: 'opd-eye-note',
		title: 'OPD Eye Note',
		noteType: 'opd',
		specialty: 'ophthalmology',
		version: 1,
		tags: ['opd', 'eye']
	},
	layout: {
		sections: [
			{
				id: 'vision',
				title: 'Vision',
				order: 0,
				fields: [
					{
						id: 'right-eye-ucva',
						key: 'right-eye-ucva',
						label: 'Right eye UCVA',
						type: 'single_choice',
						order: 0,
						required: true,
						choiceSet: {
							choices: [
								{ value: '6-6', label: '6/6' },
								{ value: '6-9', label: '6/9' }
							]
						},
						analytics: [
							{
								key: 'right-eye-ucva',
								kind: 'dimension'
							}
						]
					}
				],
				sections: [
					{
						id: 'refraction',
						title: 'Refraction',
						order: 1,
						fields: [
							{
								id: 'right-eye-sphere',
								key: 'right-eye-sphere',
								label: 'Right eye sphere',
								type: 'decimal',
								order: 0,
								unit: 'D',
								validation: {
									min: -30,
									max: 30,
									precision: 2
								}
							}
						]
					}
				],
				rules: [
					{
						id: 'require-refraction',
						order: 0,
						when: {
							field: 'right-eye-ucva',
							operator: 'not_equals',
							value: '6-6'
						},
						actions: [
							{
								type: 'require_field',
								target: 'right-eye-sphere'
							}
						]
					}
				]
			}
		]
	},
	rules: [
		{
			id: 'flag-low-vision',
			order: 0,
			when: {
				any: [
					{
						field: 'right-eye-ucva',
						operator: 'equals',
						value: '6-9'
					}
				]
			},
			actions: [{ type: 'flag_for_review', message: 'Review low vision workflow.' }]
		}
	],
	actions: [
		{
			id: 'sign-note',
			label: 'Sign note',
			type: 'sign_note',
			requiresPrivilege: 'emr-note-sign',
			order: 0
		}
	],
	analytics: {
		noteEventName: 'opd-eye-note-saved',
		dimensions: [
			{
				key: 'note-type',
				kind: 'dimension',
				valuePath: 'metadata.noteType'
			}
		]
	}
};

describe('emr note definition schema', () => {
	it('parses metadata, nested layout, choices, rules, actions, and analytics hints', () => {
		const parsed = parseEmrNoteDefinition(baseDefinition);

		expect(parsed.metadata.status).toBe('draft');
		expect(parsed.metadata.locale).toBe('en-IN');
		expect(parsed.layout.sections[0].sections[0].fields[0].width).toBe('full');
		expect(parsed.layout.sections[0].rules[0].actions[0].target).toBe('right-eye-sphere');
		expect(parsed.analytics.dimensions[0].key).toBe('note-type');
	});

	it('requires choice sets only for choice fields', () => {
		expect(() =>
			emrNoteDefinitionSchema.parse({
				...baseDefinition,
				layout: {
					sections: [
						{
							id: 'bad-choice',
							title: 'Bad choice',
							order: 0,
							fields: [
								{
									id: 'missing-choice-set',
									key: 'missing-choice-set',
									label: 'Missing choice set',
									type: 'single_choice',
									order: 0
								}
							]
						}
					]
				}
			})
		).toThrow();

		expect(() =>
			emrNoteDefinitionSchema.parse({
				...baseDefinition,
				layout: {
					sections: [
						{
							id: 'bad-choice',
							title: 'Bad choice',
							order: 0,
							fields: [
								{
									id: 'text-with-choice-set',
									key: 'text-with-choice-set',
									label: 'Text with choice set',
									type: 'text',
									order: 0,
									choiceSet: {
										choices: [{ value: 'yes', label: 'Yes' }]
									}
								}
							]
						}
					]
				}
			})
		).toThrow();
	});

	it('computes stable hashes and excludes an existing versionHash', () => {
		const hash = computeEmrNoteDefinitionVersionHash(baseDefinition);
		const hashWithExistingHash = computeEmrNoteDefinitionVersionHash({
			...baseDefinition,
			versionHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
		});

		expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
		expect(hashWithExistingHash).toBe(hash);
	});

	it('accepts optional SNOMED metadata on note fields', () => {
		const parsed = parseEmrNoteDefinition({
			...baseDefinition,
			layout: {
				sections: [
					{
						...baseDefinition.layout.sections[0],
						fields: [
							{
								...baseDefinition.layout.sections[0].fields[0],
								snomed: {
									conceptId: '247000',
									preferredTerm: 'Visual acuity',
									displayTerm: 'Visual Acuity'
								}
							}
						]
					}
				]
			}
		});

		expect(parsed.layout.sections[0].fields[0].snomed).toMatchObject({
			conceptId: '247000',
			preferredTerm: 'Visual acuity'
		});
	});

	it('rejects non-numeric SNOMED concept identifiers', () => {
		expect(() =>
			emrNoteDefinitionSchema.parse({
				...baseDefinition,
				layout: {
					sections: [
						{
							...baseDefinition.layout.sections[0],
							fields: [
								{
									...baseDefinition.layout.sections[0].fields[0],
									snomed: {
										conceptId: 'SNOMED-123'
									}
								}
							]
						}
					]
				}
			})
		).toThrow();
	});

	it('keeps SNOMED metadata in the definition hash', () => {
		const baseHash = computeEmrNoteDefinitionVersionHash(baseDefinition);
		const withSnomed = computeEmrNoteDefinitionVersionHash({
			...baseDefinition,
			layout: {
				sections: [
					{
						...baseDefinition.layout.sections[0],
						fields: [
							{
								...baseDefinition.layout.sections[0].fields[0],
								snomed: {
									conceptId: '247000',
									preferredTerm: 'Visual acuity'
								}
							}
						]
					}
				]
			}
		});

		expect(withSnomed).not.toBe(baseHash);
	});

	it('validates save draft payloads', () => {
		expect(() => emrBuilderSaveDraftSchema.parse({ definition: baseDefinition })).not.toThrow();
		expect(() =>
			emrBuilderSaveDraftSchema.parse({
				definition: { ...baseDefinition, metadata: {} }
			})
		).toThrow();
	});

	it('validates publish draft payloads', () => {
		expect(() =>
			emrBuilderPublishDraftSchema.parse({
				definitionId: 'opd-eye-note',
				reason: 'initial publish'
			})
		).not.toThrow();
	});

	it('validates definition query schema', () => {
		expect(
			emrBuilderDefinitionQuerySchema.parse({
				definitionId: 'opd-eye-note'
			})
		).toMatchObject({ definitionId: 'opd-eye-note' });
	});

	it('parses XLSForm-style bind metadata with structured expressions only', () => {
		const parsed = emrNoteDefinitionSchema.parse({
			...baseDefinition,
			layout: {
				sections: [
					{
						...baseDefinition.layout.sections[0],
						fields: [
							{
								...baseDefinition.layout.sections[0].fields[0],
								xlsv1Name: 'right_eye_ucva',
								odkBind: {
									xlsformName: 'right_eye_ucva',
									required: { value: true },
									relevant: {
										op: 'equals',
										args: [{ field: 'patient_type' }, { value: 'new' }]
									},
									constraint: {
										op: 'not_equals',
										args: [{ field: 'right-eye-ucva' }, { value: '' }]
									},
									constraintMessage: 'Select visual acuity.',
									calculation: {
										fn: 'coalesce',
										args: [{ field: 'right-eye-ucva' }, { value: 'missing' }]
									},
									appearance: 'minimal'
								}
							}
						]
					}
				]
			}
		});

		expect(parsed.layout.sections[0].fields[0].odkBind?.constraintMessage).toBe(
			'Select visual acuity.'
		);
	});

	it('rejects raw XLSForm expression strings in bind metadata', () => {
		expect(() =>
			emrNoteDefinitionSchema.parse({
				...baseDefinition,
				layout: {
					sections: [
						{
							...baseDefinition.layout.sections[0],
							fields: [
								{
									...baseDefinition.layout.sections[0].fields[0],
									odkBind: {
										relevant: '${patient_type} = "new"'
									}
								}
							]
						}
					]
				}
			})
		).toThrow();
	});

	it('supports external clinical worklist choice sources', () => {
		const parsed = emrNoteDefinitionSchema.parse({
			...baseDefinition,
			layout: {
				sections: [
					{
						...baseDefinition.layout.sections[0],
						fields: [
							{
								...baseDefinition.layout.sections[0].fields[0],
								choiceSet: {
									source: {
										kind: 'clinical_worklist',
										name: 'cataract-reported',
										filterExpression: {
											op: 'equals',
											args: [{ field: 'patient_barcode' }, { field: 'barcode' }]
										},
										valueField: 'patient_id',
										labelField: 'patient_name'
									}
								}
							}
						]
					}
				]
			}
		});

		expect(parsed.layout.sections[0].fields[0].choiceSet?.source?.kind).toBe('clinical_worklist');
	});

	it('allows repeat metadata only on repeatable groups', () => {
		const repeatDefinition = {
			...baseDefinition,
			layout: {
				sections: [
					{
						id: 'medications',
						title: 'Medications',
						kind: 'repeatable_group',
						order: 0,
						odk: {
							repeat: {
								min: 0,
								max: 5,
								count: { field: 'medication_count' }
							}
						}
					}
				]
			}
		};

		expect(() => emrNoteDefinitionSchema.parse(repeatDefinition)).not.toThrow();
		expect(() =>
			emrNoteDefinitionSchema.parse({
				...repeatDefinition,
				layout: {
					sections: [{ ...repeatDefinition.layout.sections[0], kind: 'section' }]
				}
			})
		).toThrow();
	});

	it('rejects impossible effective dates in metadata ranges', () => {
		expect(() =>
			emrNoteDefinitionSchema.parse({
				...baseDefinition,
				metadata: {
					...baseDefinition.metadata,
					effectiveFrom: '2026-05-09T00:00:00Z',
					effectiveUntil: '2025-05-09T00:00:00Z'
				}
			})
		).toThrow();
	});

	it('requires at least one field choice when a code system is named', () => {
		expect(() =>
			emrNoteDefinitionSchema.parse({
				...baseDefinition,
				layout: {
					sections: [
						{
							id: 'bad',
							title: 'Bad field',
							order: 0,
							fields: [
								{
									id: 'bad',
									key: 'bad',
									label: 'Bad field',
									type: 'single_choice',
									order: 0,
									choiceSet: {
										source: {
											kind: 'terminology',
											name: 'icd10',
											filter: { version: '11' }
										}
									}
								}
							]
						}
					]
				}
			})
		).not.toThrow();
	});
});
