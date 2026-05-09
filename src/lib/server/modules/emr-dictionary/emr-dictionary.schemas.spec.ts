import { describe, expect, it } from 'vitest';
import {
	computeEmrDictionaryAssetVersionHash,
	emrDictionaryFragmentPayloadSchema,
	emrDictionaryFieldAssetSchema,
	emrDictionaryListQuerySchema,
	emrDictionaryOpenEhrMappingSchema,
	emrDictionaryOptionSetAssetSchema,
	emrDictionarySaveDraftSchema
} from './emr-dictionary.schemas';

const fieldPayload = {
	dictionaryId: 'opd',
	key: 'vision-ucva',
	kind: 'field',
	title: 'Vision UCVA',
	tags: ['vision'],
	payload: {
		id: 'vision-ucva',
		key: 'vision-ucva',
		label: 'Vision UCVA',
		type: 'single_choice',
		required: true,
		choiceSet: {
			choices: [
				{ value: '6/6', label: '6/6' },
				{ value: '6/9', label: '6/9' }
			]
		}
	}
};

describe('EMR dictionary save schema', () => {
	const baseFieldAsset = emrDictionaryFieldAssetSchema.parse(fieldPayload);

	it('accepts reusable field assets with defaulted field order', () => {
		const parsed = emrDictionaryFieldAssetSchema.parse({
			...baseFieldAsset,
			payload: {
				...fieldPayload.payload,
				order: undefined
			}
		});

		expect(parsed.payload.order).toBe(0);
	});

	it('accepts option-set payloads with EMR choice schema', () => {
		const parsed = emrDictionaryOptionSetAssetSchema.parse({
			dictionaryId: 'opd',
			key: 'ucva-scale',
			kind: 'option_set',
			title: 'UCVA Option Set',
			tags: ['options'],
			payload: {
				choices: [
					{ value: '6/6', label: '6/6' },
					{ value: '6/9', label: '6/9' }
				]
			}
		});

		expect(parsed.payload).toMatchObject({
			choices: [
				{ value: '6/6', label: '6/6' },
				{ value: '6/9', label: '6/9' }
			]
		});
	});

	it('accepts fragment payloads with section and field snapshots', () => {
		const parsed = emrDictionaryFragmentPayloadSchema.parse({
			sections: [
				{
					id: 'vision',
					title: 'Vision',
					order: 0,
					fields: [
						{
							id: 'vision-ucva',
							key: 'vision-ucva',
							label: 'Vision UCVA',
							type: 'single_choice',
							required: true,
							choiceSet: {
								choices: [{ value: '6/6', label: '6/6' }]
							}
						}
					]
				}
			]
		});

		expect(parsed.sections).toHaveLength(1);
		expect(parsed.sections[0].fields).toHaveLength(1);
	});

	it('accepts openEHR mappings on dictionary fields, sections, and choices', () => {
		const parsed = emrDictionaryFieldAssetSchema.parse({
			...baseFieldAsset,
			payload: {
				...baseFieldAsset.payload,
				openEhrMapping: {
					archetypeId: 'openEHR-EHR-EVALUATION.visual_acuity.v1',
					archetypePath: '/items[at0010]',
					templateId: 'vcms-v1-composition',
					templatePath: '/content',
					webTemplatePath: 'opd_register/vision/ucva',
					terminologyCode: 'SNOMED-CT::3715',
					rmType: 'DV_QUANTITY',
					dataValueType: 'DV_TEXT'
				},
				choiceSet: {
					choices: [
						{
							value: '6/6',
							label: '6/6',
							openEhrMapping: {
								terminologyCode: 'SNOMED-CT::3715'
							}
						},
						{ value: '6/9', label: '6/9' }
					]
				}
			}
		});

		expect(parsed.payload.openEhrMapping?.archetypeId).toBe(
			'openEHR-EHR-EVALUATION.visual_acuity.v1'
		);
		expect(parsed.payload.openEhrMapping?.webTemplatePath).toBe('opd_register/vision/ucva');
		expect(parsed.payload.choiceSet?.choices?.[0]?.openEhrMapping).toMatchObject({
			terminologyCode: 'SNOMED-CT::3715'
		});
		expect(emrDictionaryOpenEhrMappingSchema.safeParse(parsed.payload.openEhrMapping).success).toBe(
			true
		);
	});

	it('rejects malformed openEHR mapping strings and empty mapping objects', () => {
		expect(() =>
			emrDictionaryFieldAssetSchema.parse({
				...baseFieldAsset,
				payload: {
					...baseFieldAsset.payload,
					openEhrMapping: {
						archetypeId: 'bad-archetype',
						dataValueType: 'bad'
					}
				}
			})
		).toThrow();

		expect(() =>
			emrDictionaryFieldAssetSchema.parse({
				...baseFieldAsset,
				payload: {
					...baseFieldAsset.payload,
					openEhrMapping: {}
				}
			})
		).toThrow();
	});

	it('validates polymorphic save payloads and rejects malformed input', () => {
		expect(() =>
			emrDictionarySaveDraftSchema.parse({
				...baseFieldAsset,
				payload: {
					...baseFieldAsset.payload,
					choiceSet: undefined
				}
			})
		).toThrow();

		expect(() =>
			emrDictionarySaveDraftSchema.parse({
				dictionaryId: 'opd',
				key: 'bad-fragment',
				kind: 'fragment',
				title: 'Bad',
				tags: [],
				payload: {
					fields: [],
					sections: []
				}
			})
		).toThrow();
	});

	it('normalizes asset hashes for stable canonical inputs', () => {
		const firstHash = computeEmrDictionaryAssetVersionHash({
			...baseFieldAsset,
			payload: {
				...baseFieldAsset.payload,
				order: 3
			}
		});
		const secondHash = computeEmrDictionaryAssetVersionHash({
			...baseFieldAsset,
			payload: {
				...baseFieldAsset.payload,
				order: 3
			}
		});

		expect(firstHash).toMatch(/^sha256:[a-f0-9]{64}$/);
		expect(firstHash).toBe(secondHash);
	});

	it('includes openEHR mapping in version hashes for dictionary assets', () => {
		const baseHash = computeEmrDictionaryAssetVersionHash(baseFieldAsset);
		const withMapping = computeEmrDictionaryAssetVersionHash({
			...baseFieldAsset,
			payload: {
				...baseFieldAsset.payload,
				openEhrMapping: {
					archetypeId: 'openEHR-EHR-EVALUATION.visual_acuity.v1',
					archetypePath: '/items[at0010]'
				}
			}
		});
		const withDifferentMapping = computeEmrDictionaryAssetVersionHash({
			...baseFieldAsset,
			payload: {
				...baseFieldAsset.payload,
				openEhrMapping: {
					archetypeId: 'openEHR-EHR-EVALUATION.visual_acuity.v2',
					archetypePath: '/items[at0010]'
				}
			}
		});

		expect(withMapping).toMatch(/^sha256:[a-f0-9]{64}$/);
		expect(withMapping).not.toBe(baseHash);
		expect(withDifferentMapping).not.toBe(withMapping);
	});
});

describe('EMR dictionary query schema', () => {
	it('validates dictionary list filters', () => {
		const parsed = emrDictionaryListQuerySchema.parse({
			dictionaryId: 'opd',
			kind: 'field',
			status: 'active'
		});

		expect(parsed).toMatchObject({
			dictionaryId: 'opd',
			kind: 'field',
			status: 'active'
		});
	});
});
