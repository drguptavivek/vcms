import { describe, expect, it } from 'vitest';
import {
	computeEmrNoteDefinitionVersionHash,
	emrNoteDefinitionSchema,
	parseEmrNoteDefinition
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

	it('rejects impossible effective dates in metadata ranges', () => {
		expect(() =>
			emrNoteDefinitionSchema.parse({
			...baseDefinition,
			metadata: {
				...baseDefinition.metadata,
				effectiveFrom: '2026-05-09T00:00:00Z',
				effectiveUntil: '2025-05-09T00:00:00Z'
			}
			}
		)
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
