import { describe, expect, it, vi } from 'vitest';
import { EmrBuilderRepository } from './emr-builder.repository';

function makeInsertChain<T>(resolvedRow: T) {
	return {
		values: vi.fn(() => ({
			returning: vi.fn(async () => [resolvedRow]),
			onConflictDoUpdate: vi.fn(() => ({
				returning: vi.fn(async () => [resolvedRow])
			}))
		}))
	};
}

function makeSelectChain<T>(rows: T[]) {
	return {
		from: vi.fn(() => ({
			where: vi.fn(() => ({
				orderBy: vi.fn(() => ({
					limit: vi.fn(async () => rows)
				})),
				limit: vi.fn(async () => rows)
			}))
		}))
	};
}

function makeUpdateChain<T>(resolvedRow: T) {
	return {
		set: vi.fn(() => ({
			where: vi.fn(() => ({
				returning: vi.fn(async () => [resolvedRow])
			}))
		}))
	};
}

function makeDeleteChain<T>(resolvedRow: T) {
	return {
		where: vi.fn(() => ({
			returning: vi.fn(async () => [resolvedRow])
		}))
	};
}

describe('EmrBuilderRepository', () => {
	it('upserts note definitions by definitionId', async () => {
		const definitionRow = {
			id: 'definition-1',
			definitionId: 'opd-eye-note',
			versionHash: 'sha256:11111111111111111111111111111111111111111111111111111111111111111111',
			version: 1
		} as const;
		const database = {
			insert: vi.fn(() => makeInsertChain(definitionRow)),
			onConflictDoUpdate: vi.fn(),
			select: vi.fn(),
			update: vi.fn(),
			delete: vi.fn()
		};

		const repository = new EmrBuilderRepository(database as never);
		await repository.upsertDefinition(definitionRow as never);

		expect(database.insert).toHaveBeenCalled();
		expect(database.select).not.toHaveBeenCalled();
	});

	it('loads the latest definition draft for a definition id', async () => {
		const draftRow = { id: 'draft-1', definitionId: 'definition-1' } as const;
		const database = {
			select: vi.fn(() => makeSelectChain([draftRow])),
			insert: vi.fn(),
			update: vi.fn(),
			delete: vi.fn()
		};

		const repository = new EmrBuilderRepository(database as never);
		const draft = await repository.findDraftByDefinitionId('definition-1');

		expect(draft).toMatchObject(draftRow);
		expect(database.select).toHaveBeenCalledTimes(1);
	});

	it('applies a version bump and hash update on publish', async () => {
		const updated = {
			id: 'definition-1',
			version: 2,
			versionHash: 'sha256:22222222222222222222222222222222222222222222222222222222222222222222',
			status: 'active'
		} as const;
		const database = {
			update: vi.fn(() => makeUpdateChain(updated)),
			insert: vi.fn(),
			select: vi.fn(),
			delete: vi.fn()
		};

		const repository = new EmrBuilderRepository(database as never);
		const result = await repository.applyDefinitionVersionUpdate('definition-1', {
			version: 2,
			versionHash: updated.versionHash,
			status: 'active',
			updatedBy: 'user-1'
		});

		expect(result).toMatchObject(updated);
		expect(database.update).toHaveBeenCalled();
	});

	it('deletes a draft after publish and returns removed record', async () => {
		const draftRow = { id: 'draft-1', definitionId: 'definition-1' } as const;
		const database = {
			delete: vi.fn(() => makeDeleteChain(draftRow)),
			select: vi.fn(),
			insert: vi.fn(),
			update: vi.fn()
		};

		const repository = new EmrBuilderRepository(database as never);
		const deleted = await repository.deleteDraft('definition-1');

		expect(deleted).toMatchObject(draftRow);
		expect(database.delete).toHaveBeenCalledTimes(1);
	});
});

