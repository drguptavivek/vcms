export type TerminologyProviderKind = 'mock' | 'snowstorm' | 'csnoserv';

export type SnomedConcept = {
	terminologySystem: 'SNOMED_CT';
	conceptId: string;
	preferredTerm: string;
	fullySpecifiedName?: string;
	semanticTag?: string;
	active: boolean;
	moduleId?: string;
	effectiveTime?: string;
	edition?: string;
	version?: string;
	languageRefset?: string;
	sourceService: TerminologyProviderKind;
};

export type TerminologySearchRequest = {
	q: string;
	limit: number;
	semanticTag?: string;
	active?: boolean;
};

export type TerminologyLookupRequest = {
	conceptId: string;
};

export type TerminologySearchResult = {
	provider: TerminologyProviderKind;
	edition?: string;
	version?: string;
	browserUrl?: string;
	results: SnomedConcept[];
};

export type TerminologyLookupResult = {
	provider: TerminologyProviderKind;
	edition?: string;
	version?: string;
	browserUrl?: string;
	concept: SnomedConcept;
};

export type TerminologyProviderHealth = {
	provider: TerminologyProviderKind;
	available: boolean;
	edition?: string;
	version?: string;
	browserUrl?: string;
	message?: string;
};
