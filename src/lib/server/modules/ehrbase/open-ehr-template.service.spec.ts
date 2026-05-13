import { describe, expect, it, vi } from 'vitest';
import { AppError } from '$lib/server/observability/errors';
import { OpenEhrTemplateService } from './open-ehr-template.service';

describe('OpenEhrTemplateService', () => {
	it('uploads an OPT, fetches the Web Template, and caches CDR metadata', async () => {
		const repository = {
			upsertTemplate: vi.fn().mockResolvedValue({
				id: 'template-row-1',
				templateId: 'IDCR Medication List.v0',
				cdrTemplateId: 'IDCR Medication List.v0'
			}),
			upsertWebTemplateCache: vi.fn().mockResolvedValue({
				id: 'web-template-row-1',
				templateId: 'template-row-1',
				webTemplateHash: 'hash'
			})
		};
		const client = {
			uploadOperationalTemplate: vi
				.fn()
				.mockResolvedValue({ templateId: 'IDCR Medication List.v0' }),
			listTemplates: vi.fn().mockResolvedValue([
				{
					template_id: 'IDCR Medication List.v0',
					concept: 'Medication list',
					archetype_id: 'openEHR-EHR-COMPOSITION.care_summary.v0'
				}
			]),
			getWebTemplate: vi.fn().mockResolvedValue({
				templateId: 'IDCR Medication List.v0',
				tree: {
					id: 'current_medication_list',
					rmType: 'COMPOSITION'
				}
			})
		};
		const service = new OpenEhrTemplateService(repository as never, client as never);

		await expect(
			service.uploadAndCacheAdl14Template({
				operationalTemplateXml: '<template><template_id>example</template_id></template>',
				userId: 'dev-admin'
			})
		).resolves.toMatchObject({
			template: {
				id: 'template-row-1'
			},
			webTemplateCache: {
				id: 'web-template-row-1'
			},
			webTemplate: {
				tree: { id: 'current_medication_list' }
			}
		});

		expect(repository.upsertTemplate).toHaveBeenCalledWith(
			expect.objectContaining({
				templateId: 'IDCR Medication List.v0',
				cdrTemplateId: 'IDCR Medication List.v0',
				concept: 'Medication list',
				archetypeId: 'openEHR-EHR-COMPOSITION.care_summary.v0',
				status: 'uploaded',
				webTemplateRootId: 'current_medication_list',
				uploadedBy: 'dev-admin',
				operationalTemplateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
				webTemplateHash: expect.stringMatching(/^[a-f0-9]{64}$/)
			})
		);
		expect(repository.upsertWebTemplateCache).toHaveBeenCalledWith(
			expect.objectContaining({
				templateId: 'template-row-1',
				cdrTemplateId: 'IDCR Medication List.v0',
				webTemplateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
				webTemplateJson: expect.objectContaining({
					templateId: 'IDCR Medication List.v0'
				}),
				fetchedBy: 'dev-admin'
			})
		);
	});

	it('syncs and caches an OPT when EHRbase rejects upload because it is already present', async () => {
		const repository = {
			upsertTemplate: vi.fn().mockResolvedValue({
				id: 'template-row-1',
				templateId: 'IDCR Medication List.v0',
				cdrTemplateId: 'IDCR Medication List.v0'
			}),
			upsertWebTemplateCache: vi.fn().mockResolvedValue({
				id: 'web-template-row-1',
				templateId: 'template-row-1',
				webTemplateHash: 'hash'
			})
		};
		const client = {
			uploadOperationalTemplate: vi
				.fn()
				.mockRejectedValue(
					new AppError(
						'EHRBASE_TEMPLATE_UPLOAD_FAILED',
						'Clinical data repository rejected the template.',
						502,
						{ status: 409, responseBodyHash: 'a'.repeat(64) }
					)
				),
			listTemplates: vi.fn().mockResolvedValue([
				{
					template_id: 'IDCR Medication List.v0',
					concept: 'IDCR Medication List.v0',
					archetype_id: 'openEHR-EHR-COMPOSITION.care_summary.v0'
				}
			]),
			getWebTemplate: vi.fn().mockResolvedValue({
				templateId: 'IDCR Medication List.v0',
				tree: {
					id: 'current_medication_list',
					rmType: 'COMPOSITION'
				}
			})
		};
		const service = new OpenEhrTemplateService(repository as never, client as never);

		await expect(
			service.uploadAndCacheAdl14Template({
				operationalTemplateXml: `
					<template>
						<template_id>
							<value>IDCR Medication List.v0</value>
						</template_id>
					</template>
				`,
				userId: 'dev-admin'
			})
		).resolves.toMatchObject({
			template: {
				id: 'template-row-1'
			},
			webTemplateCache: {
				id: 'web-template-row-1'
			}
		});

		expect(client.getWebTemplate).toHaveBeenCalledWith('IDCR Medication List.v0');
		expect(repository.upsertTemplate).toHaveBeenCalledWith(
			expect.objectContaining({
				templateId: 'IDCR Medication List.v0',
				operationalTemplateHash: expect.stringMatching(/^[a-f0-9]{64}$/)
			})
		);
	});

	it('rejects a sync when EHRbase does not list the requested template', async () => {
		const service = new OpenEhrTemplateService(
			{
				upsertTemplate: vi.fn(),
				upsertWebTemplateCache: vi.fn()
			} as never,
			{
				listTemplates: vi.fn().mockResolvedValue([]),
				getWebTemplate: vi.fn().mockResolvedValue({
					templateId: 'missing',
					tree: { id: 'missing', rmType: 'COMPOSITION' }
				})
			} as never
		);

		await expect(service.syncTemplateFromCdr({ templateId: 'missing' })).rejects.toMatchObject({
			code: 'EHRBASE_TEMPLATE_NOT_FOUND',
			status: 404
		});
	});

	it('builds a runtime manifest from the cached Web Template tree', async () => {
		const repository = {
			findTemplateByTemplateId: vi.fn().mockResolvedValue({
				id: 'template-row-1',
				templateId: 'IDCR Medication List.v0',
				cdrTemplateId: 'IDCR Medication List.v0'
			}),
			findWebTemplateCacheByTemplateId: vi.fn().mockResolvedValue({
				id: 'web-template-row-1',
				templateId: 'template-row-1',
				webTemplateHash: 'web-template-hash',
				webTemplateJson: {
					templateId: 'IDCR Medication List.v0',
					defaultLanguage: 'en',
					languages: ['en'],
					tree: {
						id: 'current_medication_list',
						name: 'Current medication list',
						rmType: 'COMPOSITION',
						nodeId: 'openEHR-EHR-COMPOSITION.care_summary.v0',
						min: 1,
						max: 1,
						children: [
							{
								id: 'context',
								name: 'Context',
								rmType: 'EVENT_CONTEXT',
								inContext: true,
								children: [
									{
										id: 'start_time',
										name: 'Start time',
										rmType: 'DV_DATE_TIME',
										min: 1,
										max: 1,
										inContext: true,
										inputs: [{ suffix: '', type: 'DATETIME' }]
									}
								]
							},
							{
								id: 'medication_and_medical_devices',
								localizedName: 'Medication and medical devices',
								rmType: 'SECTION',
								min: 0,
								max: -1,
								children: [
									{
										id: 'current_medication',
										name: 'Current medication',
										rmType: 'OBSERVATION',
										min: 0,
										max: -1,
										children: [
											{
												id: 'medication_statement',
												name: 'Medication statement',
												rmType: 'CLUSTER',
												min: 0,
												max: -1,
												children: [
													{
														id: 'medication_item',
														name: 'Medication item',
														rmType: 'DV_TEXT',
														min: 1,
														max: 1,
														inputs: [{ suffix: '', type: 'TEXT' }]
													},
													{
														id: 'route',
														name: 'Route',
														rmType: 'DV_CODED_TEXT',
														min: 0,
														max: -1,
														inputs: [
															{
																suffix: 'code',
																type: 'CODED_TEXT',
																terminology: 'local',
																list: [{ value: 'oral', label: 'Oral' }]
															}
														]
													}
												]
											}
										]
									}
								]
							}
						]
					}
				}
			})
		};
		const service = new OpenEhrTemplateService(repository as never, {} as never);

		const manifest = await service.getRuntimeManifest('IDCR Medication List.v0');

		expect(manifest).toMatchObject({
			templateId: 'IDCR Medication List.v0',
			cdrTemplateId: 'IDCR Medication List.v0',
			webTemplateHash: 'web-template-hash',
			rootId: 'current_medication_list',
			defaultLanguage: 'en',
			languages: ['en']
		});
		expect(manifest.sections).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: 'current_medication_list',
					baseFlatPath: 'current_medication_list',
					required: true,
					repeating: false
				}),
				expect.objectContaining({
					id: 'medication_and_medical_devices',
					baseFlatPath: 'current_medication_list/medication_and_medical_devices:0',
					repeating: true
				}),
				expect.objectContaining({
					id: 'current_medication',
					baseFlatPath:
						'current_medication_list/medication_and_medical_devices:0/current_medication:0',
					repeating: true
				})
			])
		);
		expect(manifest.fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: 'start_time',
					baseFlatPath: 'current_medication_list/context/start_time',
					inContext: true,
					inputs: [
						expect.objectContaining({
							flatPath: 'current_medication_list/context/start_time'
						})
					]
				}),
				expect.objectContaining({
					id: 'medication_item',
					required: true,
					repeating: true,
					inputs: [
						expect.objectContaining({
							flatPath:
								'current_medication_list/medication_and_medical_devices:0/current_medication:0/medication_statement:0/medication_item'
						})
					]
				}),
				expect.objectContaining({
					id: 'route',
					repeating: true,
					inputs: [
						expect.objectContaining({
							flatPath:
								'current_medication_list/medication_and_medical_devices:0/current_medication:0/medication_statement:0/route:0|code',
							options: [{ value: 'oral', label: 'Oral' }]
						})
					]
				})
			])
		);
	});
});
