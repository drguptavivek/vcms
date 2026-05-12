import { describe, expect, it, vi } from 'vitest';
import { PatientRepository } from './patient.repository';

function databaseForInsert(created: unknown, existing: unknown[] = []) {
	const valuesCalledWith = vi.fn();
	const values = vi.fn((input: unknown) => {
		valuesCalledWith(input);
		return { onConflictDoNothing };
	});
	const limit = vi.fn(() => Promise.resolve(existing));
	const where = vi.fn(() => ({ limit }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	const returning = vi.fn(() => Promise.resolve(created ? [created] : []));
	const onConflictDoNothing = vi.fn(() => ({ returning }));
	const insert = vi.fn(() => ({ values }));

	return {
		database: { insert, select },
		calls: {
			insert,
			values,
			onConflictDoNothing,
			returning,
			select,
			from,
			where,
			limit,
			valuesCalledWith
		}
	};
}

function databaseForOpenEhrIdentityUpdate(updated: unknown) {
	const returning = vi.fn(() => Promise.resolve(updated ? [updated] : []));
	const where = vi.fn(() => ({ returning }));
	const setCalledWith = vi.fn();
	const set = vi.fn((input: unknown) => {
		setCalledWith(input);
		return { where };
	});
	const update = vi.fn(() => ({ set }));

	return {
		database: { update },
		calls: {
			update,
			set,
			setCalledWith,
			where,
			returning
		}
	};
}

describe('PatientRepository', () => {
	it('returns the newly inserted patient for a new barcode', async () => {
		const patient = {
			id: 'patient-1',
			barcode: '01-26-000001',
			fullName: 'Asha Devi'
		};
		const { database, calls } = databaseForInsert(patient);
		const repository = new PatientRepository(database as never);

		await expect(
			repository.createForBarcode({
				barcode: '01-26-000001',
				fullName: 'Asha Devi',
				createdBy: 'user-1'
			})
		).resolves.toBe(patient);

		expect(calls.onConflictDoNothing).toHaveBeenCalledTimes(1);
		expect(calls.select).not.toHaveBeenCalled();
		expect(calls.valuesCalledWith).toHaveBeenCalledWith(
			expect.objectContaining({
				barcode: '01-26-000001',
				fullName: 'Asha Devi',
				createdBy: 'user-1'
			})
		);
	});

	it('returns the existing patient when barcode uniqueness has already been claimed', async () => {
		const existing = {
			id: 'patient-existing',
			barcode: '01-26-000001',
			fullName: 'Earlier Registration'
		};
		const { database, calls } = databaseForInsert(undefined, [existing]);
		const repository = new PatientRepository(database as never);

		await expect(
			repository.createForBarcode({
				barcode: '01-26-000001',
				fullName: 'Asha Devi',
				createdBy: 'user-1'
			})
		).resolves.toBe(existing);

		expect(calls.onConflictDoNothing).toHaveBeenCalledTimes(1);
		expect(calls.select).toHaveBeenCalledTimes(1);
		expect(calls.limit).toHaveBeenCalledWith(1);
		expect(calls.where).toHaveBeenCalledTimes(1);
	});

	it('falls back to lookup when insert returns no row for an existing barcode', async () => {
		const existing = {
			id: 'patient-existing',
			barcode: '01-26-000001',
			fullName: 'Earlier Registration'
		};
		const { database, calls } = databaseForInsert(undefined, [existing]);
		const repository = new PatientRepository(database as never);

		await expect(
			repository.createForBarcode({
				barcode: '01-26-000001',
				fullName: 'Asha Devi',
				createdBy: 'user-1'
			})
		).resolves.toBe(existing);

		expect(calls.insert).toHaveBeenCalledTimes(1);
		expect(calls.select).toHaveBeenCalledTimes(1);
		expect(calls.onConflictDoNothing).toHaveBeenCalledTimes(1);
	});

	it('stores the linked openEHR identity for a local patient', async () => {
		const updated = {
			id: 'patient-1',
			openEhrId: 'ehr-1',
			openEhrSubjectId: 'patient-1',
			openEhrSubjectNamespace: 'vcms-patient'
		};
		const { database, calls } = databaseForOpenEhrIdentityUpdate(updated);
		const repository = new PatientRepository(database as never);

		await expect(
			repository.updateOpenEhrIdentity('patient-1', {
				openEhrId: 'ehr-1',
				openEhrSubjectId: 'patient-1',
				openEhrSubjectNamespace: 'vcms-patient'
			})
		).resolves.toBe(updated);

		expect(calls.update).toHaveBeenCalledTimes(1);
		expect(calls.where).toHaveBeenCalledTimes(1);
		expect(calls.setCalledWith).toHaveBeenCalledWith(
			expect.objectContaining({
				openEhrId: 'ehr-1',
				openEhrSubjectId: 'patient-1',
				openEhrSubjectNamespace: 'vcms-patient',
				updatedAt: expect.any(Date)
			})
		);
	});
});
