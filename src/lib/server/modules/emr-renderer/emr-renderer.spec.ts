import { describe, expect, it, vi } from 'vitest';
import { evaluateEmrExpression, EmrRendererService } from './emr-renderer.service';

describe('EMR expression evaluator', () => {
	it('evaluates boolean, comparison, membership, and arithmetic operators', () => {
		const context = {
			patient_type: 'new',
			age: '30',
			role: 'doctor',
			tags: ['new', 'vip'],
			legacy: ''
		};

		const canSubmit = evaluateEmrExpression(
			{
				op: 'and',
				args: [
					{
						op: 'equals',
						args: [{ field: 'patient_type' }, { value: 'new' }]
					},
					{
						op: 'in',
						args: [{ field: 'role' }, { value: ['admin', 'doctor'] }]
					},
					{
						op: 'greater_than',
						args: [{ op: 'add', args: [{ field: 'age' }, { value: 5 }] }, { value: 30 }]
					}
				]
			},
			context
		);

		const constraintByLegacy = evaluateEmrExpression(
			{
				op: 'equals',
				args: [{ value: 'legacy' }, { value: 'active' }]
			},
			context
		);

		expect(canSubmit).toBe(true);
		expect(constraintByLegacy).toBe(false);
	});

	it('supports selected and count-selected helpers', () => {
		const context = {
			multi: 'a b c'
		};

		expect(
			evaluateEmrExpression(
				{
					fn: 'selected',
					args: [{ field: 'multi' }, { value: 'b' }]
				},
				context
			)
		).toBe(true);

		expect(
			evaluateEmrExpression(
				{
					fn: 'count-selected',
					args: [{ field: 'multi' }]
				},
				context
			)
		).toBe(3);

		expect(
			evaluateEmrExpression(
				{
					fn: 'coalesce',
					args: [{ field: 'missing' }, { value: 'fallback' }]
				},
				{}
			)
		).toBe('fallback');
	});
});

describe('EMR renderer service', () => {
	it('renders a safe ODK bind contract with pass-through choices and actions', async () => {
		const definition = {
			metadata: {
				definitionId: 'pec-opd-eye',
				slug: 'pec-opd-eye',
				title: 'PEC OPD Eye',
				noteType: 'pec_opd',
				specialty: 'ophthalmology',
				version: 3,
				tags: ['eye', 'opd'],
				status: 'active',
				locale: 'en-IN'
			},
			layout: {
				sections: [
					{
						id: 'section-1',
						title: 'Symptoms',
						order: 0,
						fields: [
							{
								id: 'patient-type',
								key: 'patient-type',
								label: 'Patient type',
								type: 'text',
								xlsv1Name: 'patient_type',
								order: 0,
								required: false
							},
							{
								id: 'symptom',
								key: 'symptom',
								label: 'Symptom',
								type: 'single_choice',
								order: 1,
								choiceSet: {
									source: {
										kind: 'master_data',
										name: 'symptom-codes',
										filter: { active: true }
									}
								},
								odkBind: {
									xlsformName: 'symptom',
									required: {
										op: 'equals',
										args: [{ field: 'patient-type' }, { value: 'new' }]
									},
									relevant: {
										op: 'equals',
										args: [{ field: 'patient_type' }, { value: 'new' }]
									},
									constraint: {
										op: 'not_equals',
										args: [{ field: 'symptom' }, { value: '' }]
									},
									constraintMessage: 'Symptom is required.',
									calculation: {
										fn: 'coalesce',
										args: [{ field: 'symptom_count' }, { value: 0 }]
									},
									readOnly: {
										op: 'equals',
										args: [{ field: 'status' }, { value: 'closed' }]
									},
									appearance: 'minimal'
								},
								defaultValue: {
									value: 'N/A'
								},
								required: false
							}
						],
						sections: [],
						rules: [],
						odk: {
							xlsformName: 'pec_opd_eye'
						},
						collapsible: false,
						defaultCollapsed: false
					}
				]
			},
			rules: [
				{
					id: 'flag-test',
					order: 0,
					when: {
						field: 'symptom',
						operator: 'not_equals',
						value: 'none'
					},
					actions: [
						{
							type: 'flag_for_review',
							message: 'Manual review'
						}
					]
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
			analytics: {}
		};

		const repository = {
			findDefinitionByDefinitionId: vi.fn(async () => ({ id: 'definition-id', status: 'active' })),
			findLatestVersion: vi.fn(async () => ({ payloadJson: definition }))
		} as unknown as {
			findDefinitionByDefinitionId: (
				definitionId: string
			) => Promise<{ id: string; status: string }>;
			findLatestVersion: (definitionId: string) => Promise<{ payloadJson: unknown }>;
		};

		const service = new EmrRendererService(repository);

		const model = await service.renderPublishedDefinition({
			definitionId: 'pec-opd-eye',
			answers: {
				patient_type: 'new',
				status: 'closed',
				symptom_count: 2,
				symptom: ''
			}
		});

		const symptomField = model.sections[0].fields[1];
		expect(symptomField.bind.required).toMatchObject({
			value: true
		});
		expect(symptomField.bind.relevant).toMatchObject({ value: true });
		expect(symptomField.bind.readOnly.value).toBe(true);
		expect(symptomField.bind.calculation).toMatchObject({ value: 2, source: { fn: 'coalesce' } });
		expect(symptomField.bind.constraint).toMatchObject({
			expression: { op: 'not_equals' },
			passes: false,
			message: 'Symptom is required.'
		});
		expect(symptomField.bind.defaultValue).toMatchObject({
			value: 'N/A',
			source: { value: 'N/A' }
		});
		expect(symptomField.choiceSet?.source).toMatchObject({
			kind: 'master_data',
			name: 'symptom-codes'
		});
		expect(model.actions).toMatchObject([
			{
				id: 'sign-note',
				type: 'sign_note'
			}
		]);
	});
});
