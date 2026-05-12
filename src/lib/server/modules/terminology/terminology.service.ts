import { env } from '$env/dynamic/private';
import { AppError, notFound } from '$lib/server/observability/errors';
import type {
	SnomedConcept,
	TerminologyLookupRequest,
	TerminologyLookupResult,
	TerminologyProviderHealth,
	TerminologyProviderKind,
	TerminologySearchRequest,
	TerminologySearchResult
} from './terminology.types';

type TerminologyProvider = {
	kind: TerminologyProviderKind;
	search(request: TerminologySearchRequest): Promise<SnomedConcept[]>;
	lookup(request: TerminologyLookupRequest): Promise<SnomedConcept | null>;
	health(): Promise<TerminologyProviderHealth>;
};

const mockConcepts: SnomedConcept[] = [
	{
		terminologySystem: 'SNOMED_CT',
		conceptId: '193570009',
		preferredTerm: 'Cataract',
		fullySpecifiedName: 'Cataract (disorder)',
		semanticTag: 'disorder',
		active: true,
		sourceService: 'mock'
	},
	{
		terminologySystem: 'SNOMED_CT',
		conceptId: '23986001',
		preferredTerm: 'Glaucoma',
		fullySpecifiedName: 'Glaucoma (disorder)',
		semanticTag: 'disorder',
		active: true,
		sourceService: 'mock'
	},
	{
		terminologySystem: 'SNOMED_CT',
		conceptId: '404684003',
		preferredTerm: 'Clinical finding',
		fullySpecifiedName: 'Clinical finding (finding)',
		semanticTag: 'finding',
		active: true,
		sourceService: 'mock'
	},
	{
		terminologySystem: 'SNOMED_CT',
		conceptId: '71388002',
		preferredTerm: 'Procedure',
		fullySpecifiedName: 'Procedure (procedure)',
		semanticTag: 'procedure',
		active: true,
		sourceService: 'mock'
	},
	{
		terminologySystem: 'SNOMED_CT',
		conceptId: '386053000',
		preferredTerm: 'Evaluation procedure',
		fullySpecifiedName: 'Evaluation procedure (procedure)',
		semanticTag: 'procedure',
		active: true,
		sourceService: 'mock'
	}
];

function configuredProvider(): TerminologyProviderKind {
	const value = env.TERMINOLOGY_PROVIDER?.trim().toLowerCase();
	if (value === 'snowstorm' || value === 'csnoserv') return value;
	return 'mock';
}

function configuredBrowserUrl() {
	return env.SNOMED_BROWSER_URL?.trim() || undefined;
}

function configuredEdition() {
	return env.SNOMED_EDITION?.trim() || 'SNOMEDCT-International';
}

function configuredVersion() {
	return env.SNOMED_VERSION?.trim() || undefined;
}

function configuredLanguageRefset() {
	return env.SNOMED_LANGUAGE_REFSET?.trim() || undefined;
}

function withConfiguredMetadata(concept: SnomedConcept, sourceService: TerminologyProviderKind) {
	return {
		...concept,
		sourceService,
		edition: concept.edition ?? configuredEdition(),
		version: concept.version ?? configuredVersion(),
		languageRefset: concept.languageRefset ?? configuredLanguageRefset()
	};
}

function matchesSearch(concept: SnomedConcept, request: TerminologySearchRequest) {
	const query = request.q.toLowerCase();
	const searchable = [
		concept.conceptId,
		concept.preferredTerm,
		concept.fullySpecifiedName,
		concept.semanticTag
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();

	if (!searchable.includes(query)) return false;
	if (request.active !== undefined && concept.active !== request.active) return false;
	if (
		request.semanticTag &&
		concept.semanticTag?.toLowerCase() !== request.semanticTag.toLowerCase()
	) {
		return false;
	}

	return true;
}

class MockTerminologyProvider implements TerminologyProvider {
	kind = 'mock' as const;

	async search(request: TerminologySearchRequest) {
		return mockConcepts
			.filter((concept) => matchesSearch(concept, request))
			.slice(0, request.limit)
			.map((concept) => withConfiguredMetadata(concept, this.kind));
	}

	async lookup(request: TerminologyLookupRequest) {
		const concept = mockConcepts.find((entry) => entry.conceptId === request.conceptId);
		return concept ? withConfiguredMetadata(concept, this.kind) : null;
	}

	async health() {
		return {
			provider: this.kind,
			available: true,
			edition: configuredEdition(),
			version: configuredVersion(),
			browserUrl: configuredBrowserUrl(),
			message: 'Development mock provider. Configure Snowstorm or CSNOServ before clinical use.'
		};
	}
}

class UnconfiguredRemoteTerminologyProvider implements TerminologyProvider {
	constructor(public readonly kind: 'snowstorm' | 'csnoserv') {}

	async search(_request: TerminologySearchRequest): Promise<SnomedConcept[]> {
		throw this.unavailable();
	}

	async lookup(_request: TerminologyLookupRequest): Promise<SnomedConcept | null> {
		throw this.unavailable();
	}

	async health() {
		return {
			provider: this.kind,
			available: false,
			edition: configuredEdition(),
			version: configuredVersion(),
			browserUrl: configuredBrowserUrl(),
			message: `${this.kind} is selected but no provider URL is configured.`
		};
	}

	private unavailable() {
		return new AppError(
			'TERMINOLOGY_PROVIDER_UNAVAILABLE',
			'Terminology service is not configured.',
			503
		);
	}
}

class SnowstormTerminologyProvider implements TerminologyProvider {
	kind = 'snowstorm' as const;

	constructor(private readonly baseUrl: string) {}

	async search(request: TerminologySearchRequest) {
		const branch = encodeURIComponent(env.SNOWSTORM_BRANCH?.trim() || 'MAIN');
		const url = new URL(`${this.baseUrl.replace(/\/$/, '')}/browser/${branch}/concepts`);
		url.searchParams.set('term', request.q);
		url.searchParams.set('limit', String(request.limit));
		url.searchParams.set('activeFilter', String(request.active ?? true));
		if (request.semanticTag) url.searchParams.set('semanticTag', request.semanticTag);

		const payload = await this.fetchJson(url);
		const items = Array.isArray(payload.items) ? payload.items : [];
		return items
			.map((item) => this.toConcept(item))
			.filter((item): item is SnomedConcept => Boolean(item));
	}

	async lookup(request: TerminologyLookupRequest) {
		const branch = encodeURIComponent(env.SNOWSTORM_BRANCH?.trim() || 'MAIN');
		const url = new URL(
			`${this.baseUrl.replace(/\/$/, '')}/browser/${branch}/concepts/${request.conceptId}`
		);
		return this.toConcept(await this.fetchJson(url));
	}

	async health() {
		return {
			provider: this.kind,
			available: true,
			edition: configuredEdition(),
			version: configuredVersion(),
			browserUrl: configuredBrowserUrl()
		};
	}

	private async fetchJson(url: URL) {
		const response = await fetch(url, {
			headers: { accept: 'application/json' }
		});
		if (!response.ok) {
			throw new AppError(
				'TERMINOLOGY_PROVIDER_FAILED',
				'Terminology service request failed.',
				response.status >= 500 ? 503 : 502
			);
		}
		return response.json() as Promise<Record<string, unknown>>;
	}

	private toConcept(item: Record<string, unknown>): SnomedConcept | null {
		const conceptId = String(item.conceptId ?? item.id ?? '').trim();
		if (!/^\d+$/.test(conceptId)) return null;
		const fsn = textValue(item.fsn);
		const preferredTerm = textValue(item.pt) || textValue(item.preferredTerm) || fsn || conceptId;

		return {
			terminologySystem: 'SNOMED_CT',
			conceptId,
			preferredTerm,
			fullySpecifiedName: fsn,
			semanticTag: semanticTag(fsn),
			active: item.active === undefined ? true : Boolean(item.active),
			moduleId: stringValue(item.moduleId),
			effectiveTime: stringValue(item.effectiveTime),
			sourceService: this.kind,
			edition: configuredEdition(),
			version: configuredVersion(),
			languageRefset: configuredLanguageRefset()
		};
	}
}

function textValue(value: unknown) {
	if (typeof value === 'string') return value;
	if (value && typeof value === 'object') {
		const term = (value as { term?: unknown }).term;
		if (typeof term === 'string') return term;
	}
	return undefined;
}

function stringValue(value: unknown) {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function semanticTag(fsn: string | undefined) {
	const match = fsn?.match(/\(([^()]+)\)\s*$/);
	return match?.[1];
}

function providerForConfig(): TerminologyProvider {
	const provider = configuredProvider();
	if (provider === 'mock') return new MockTerminologyProvider();
	const baseUrl =
		provider === 'snowstorm' ? env.SNOWSTORM_BASE_URL?.trim() : env.CSNOSERV_BASE_URL?.trim();
	if (!baseUrl) return new UnconfiguredRemoteTerminologyProvider(provider);
	if (provider === 'snowstorm') return new SnowstormTerminologyProvider(baseUrl);
	return new UnconfiguredRemoteTerminologyProvider(provider);
}

export class TerminologyService {
	async searchSnomedConcepts(request: TerminologySearchRequest): Promise<TerminologySearchResult> {
		const provider = providerForConfig();
		const results = await provider.search(request);
		return {
			provider: provider.kind,
			edition: configuredEdition(),
			version: configuredVersion(),
			browserUrl: configuredBrowserUrl(),
			results
		};
	}

	async lookupSnomedConcept(request: TerminologyLookupRequest): Promise<TerminologyLookupResult> {
		const provider = providerForConfig();
		const concept = await provider.lookup(request);
		if (!concept) throw notFound('SNOMED CT concept was not found.');
		return {
			provider: provider.kind,
			edition: configuredEdition(),
			version: configuredVersion(),
			browserUrl: configuredBrowserUrl(),
			concept
		};
	}

	async health(): Promise<TerminologyProviderHealth> {
		return providerForConfig().health();
	}
}

export const terminologyService = new TerminologyService();
