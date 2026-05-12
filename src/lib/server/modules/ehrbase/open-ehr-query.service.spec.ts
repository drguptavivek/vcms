import { describe, expect, it, vi } from 'vitest';
import { OpenEhrQueryService } from './open-ehr-query.service';

describe('OpenEhrQueryService', () => {
	it('lists curated queries without exposing raw AQL', () => {
		const service = new OpenEhrQueryService({ executeAql: vi.fn() } as never);

		const queries = service.listQueries();

		expect(queries).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: 'composition.list_by_ehr',
					parameters: expect.objectContaining({
						ehrId: expect.objectContaining({ type: 'ehr_id', required: true })
					})
				})
			])
		);
		expect(queries[0]).not.toHaveProperty('aql');
	});

	it('executes a registered query with validated parameters and capped fetch', async () => {
		const client = {
			executeAql: vi.fn().mockResolvedValue({
				columns: [{ name: 'composition_uid' }],
				rows: [['composition-1']]
			})
		};
		const service = new OpenEhrQueryService(client as never);

		const result = await service.execute({
			queryId: 'composition.list_by_ehr',
			parameters: {
				ehrId: 'd2b810bd-7ce8-4b76-94f2-2e9eb43f22bc'
			},
			fetch: 999
		});

		expect(client.executeAql).toHaveBeenCalledWith(
			expect.objectContaining({
				q: expect.stringContaining('CONTAINS COMPOSITION c'),
				query_parameters: {
					ehrId: 'd2b810bd-7ce8-4b76-94f2-2e9eb43f22bc'
				},
				offset: 0,
				fetch: 100
			})
		);
		expect(result.query).not.toHaveProperty('aql');
		expect(result.result.rows).toEqual([['composition-1']]);
	});

	it('rejects unknown query ids before reaching EHRbase', async () => {
		const client = { executeAql: vi.fn() };
		const service = new OpenEhrQueryService(client as never);

		await expect(service.execute({ queryId: 'bad.query' })).rejects.toMatchObject({
			code: 'OPENEHR_AQL_QUERY_NOT_FOUND',
			status: 404
		});
		expect(client.executeAql).not.toHaveBeenCalled();
	});

	it('rejects missing, invalid, and unknown parameters before reaching EHRbase', async () => {
		const client = { executeAql: vi.fn() };
		const service = new OpenEhrQueryService(client as never);

		await expect(service.execute({ queryId: 'composition.list_by_ehr' })).rejects.toMatchObject({
			code: 'VALIDATION_FAILED'
		});
		await expect(
			service.execute({
				queryId: 'composition.list_by_ehr',
				parameters: { ehrId: 'not-a-uuid' }
			})
		).rejects.toMatchObject({
			code: 'VALIDATION_FAILED'
		});
		await expect(
			service.execute({
				queryId: 'composition.list_by_ehr',
				parameters: {
					ehrId: 'd2b810bd-7ce8-4b76-94f2-2e9eb43f22bc',
					rawAql: 'SELECT e FROM EHR e'
				}
			})
		).rejects.toMatchObject({
			code: 'VALIDATION_FAILED'
		});
		expect(client.executeAql).not.toHaveBeenCalled();
	});
});
