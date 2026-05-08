import pecOpdRegister from './pec-opd-register.json';
import reportedPatientsRecord from './reported-patients-record.json';
import cataractSurgeryRecord from './cataract-surgery-record.json';
import cataractFollowupRecord from './cataract-followup-record.json';
import type { XlsformFixture } from '../xlsform-import.types';

export const pecOpdRegisterFixture = pecOpdRegister as XlsformFixture;
export const reportedPatientsRecordFixture = reportedPatientsRecord as XlsformFixture;
export const cataractSurgeryRecordFixture = cataractSurgeryRecord as XlsformFixture;
export const cataractFollowupRecordFixture = cataractFollowupRecord as XlsformFixture;

export const PEC_XLSFORMS: readonly XlsformFixture[] = [
	pecOpdRegisterFixture,
	reportedPatientsRecordFixture,
	cataractSurgeryRecordFixture,
	cataractFollowupRecordFixture
];
