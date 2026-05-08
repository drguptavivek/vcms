<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ReprintCodePanel from '$lib/components/barcode/ReprintCodePanel.svelte';
	import { getDefaultQzPrinter, listQzPrinters, printRawBarcode } from '$lib/qz/qz-direct-print';
	import { onMount } from 'svelte';

	let { data } = $props();

	type PrintResponse = {
		batch: { id: string };
		startSerial?: number;
		endSerial?: number;
		barcodes: string[];
		print:
			| { output: 'html_pdf'; content: Array<{ value: string; svg: string }> }
			| { output: 'zpl' | 'epl'; content: string };
	};
	type RawOutput = 'zpl' | 'epl';
	type BarcodeOutput = 'html_pdf' | RawOutput;
	type BrowserPrintProfile = 'a4' | 'a5';
	type QzDefaultSettings = Record<RawOutput, { printer: string; templateId: string }> & {
		defaultOutput: BarcodeOutput;
		browserPrint: { profile: BrowserPrintProfile };
	};

	let search = $state('');
	let selectedOutput = $state<'html_pdf' | 'zpl' | 'epl'>('html_pdf');
	let selectedTemplateId = $state('');
	let responseData = $state<PrintResponse | null>(null);
	let message = $state('');
	let qzMessage = $state('');
	let qzDefaultMessage = $state('');
	let qzBusy = $state(false);
	let qzPrinters = $state<string[]>([]);
	let selectedQzPrinter = $state('');
	let qzDefaultPanelOpen = $state(false);
	let printOutputOpen = $state(false);
	let qzDefaults = $state<QzDefaultSettings>({
		defaultOutput: 'html_pdf',
		zpl: { printer: '', templateId: '' },
		epl: { printer: '', templateId: '' },
		browserPrint: { profile: 'a4' }
	});
	let reservePec = $state<(typeof data.pecs)[number] | null>(null);
	let expandedSkipHistoryPecId = $state<number | null>(null);
	let pendingGenerate = $state<{
		pec: (typeof data.pecs)[number];
		quantity: number;
		startSerial: number;
		endSerial: number;
	} | null>(null);
	let pendingReprintPec = $state<(typeof data.pecs)[number] | null>(null);
	let pendingRecentReprint = $state<{
		run: (typeof data.recentPrintRuns)[number];
	} | null>(null);
	const svgDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	const qzDefaultsStorageKey = 'vcms.qz.barcodeDefaults.v1';
	const sampleBarcode = 'XX-XX-XXXXXX';
	const emptyQzDefaults: QzDefaultSettings = {
		defaultOutput: 'html_pdf',
		zpl: { printer: '', templateId: '' },
		epl: { printer: '', templateId: '' },
		browserPrint: { profile: 'a4' }
	};

	onMount(() => {
		const localDefaults = readLocalQzDefaults();
		const profileDefaults = normalizeQzDefaults(data.printPreferences);
		qzDefaults =
			localDefaults && hasMeaningfulQzDefaults(localDefaults) ? localDefaults : profileDefaults;
		if (
			(!localDefaults || !hasMeaningfulQzDefaults(localDefaults)) &&
			hasMeaningfulQzDefaults(profileDefaults)
		) {
			persistLocalQzDefaults(profileDefaults);
		}
		selectedOutput = qzDefaults.defaultOutput;
		applyOutputDefaults(selectedOutput);
	});

	let filteredPecs = $derived(
		data.pecs.filter((pec) => {
			const query = search.trim().toLowerCase();
			const matchesSearch =
				!query ||
				pec.name.toLowerCase().includes(query) ||
				String(pec.code).padStart(2, '0').includes(query);
			return matchesSearch;
		})
	);

	async function postJson(url: string, body: Record<string, unknown>, fallbackMessage: string) {
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		const json = await response.json();
		if (!response.ok) {
			message = json.error?.message ?? fallbackMessage;
			return null;
		}
		message = '';
		return json.data as PrintResponse;
	}

	function barcodeValue(pecCode: number, serial: number) {
		return `${String(pecCode).padStart(2, '0')}-${String(data.year).padStart(2, '0')}-${String(serial).padStart(6, '0')}`;
	}

	function setSelectedOutput(event: Event) {
		selectedOutput = (event.currentTarget as HTMLSelectElement).value as typeof selectedOutput;
		applyOutputDefaults(selectedOutput);
	}

	function setActionOutput(event: Event) {
		setSelectedOutput(event);
	}

	function prepareGenerate(event: SubmitEvent, pec: (typeof data.pecs)[number]) {
		event.preventDefault();
		const form = new FormData(event.currentTarget as HTMLFormElement);
		const quantity = Number(form.get('quantity'));
		if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
			message = 'Enter a quantity between 1 and 1000.';
			return;
		}
		pendingGenerate = {
			pec,
			quantity,
			startSerial: pec.nextSerial,
			endSerial: pec.nextSerial + quantity - 1
		};
		responseData = null;
		printOutputOpen = false;
		message = '';
	}

	function cancelGenerate() {
		pendingGenerate = null;
	}

	function toggleSkipHistory(pecId: number) {
		expandedSkipHistoryPecId = expandedSkipHistoryPecId === pecId ? null : pecId;
	}

	function openReprintRange(pec: (typeof data.pecs)[number]) {
		if (!pec.printedRanges.length) {
			message = 'Reprint is available only after at least one barcode has been printed for this PEC/year.';
			return;
		}
		applySavedBarcodeOutputDefaults();
		pendingReprintPec = pec;
		pendingGenerate = null;
		pendingRecentReprint = null;
		responseData = null;
		message = '';
	}

	function cancelReprintRange() {
		pendingReprintPec = null;
	}

	async function confirmGenerateBatch() {
		if (!pendingGenerate) return;
		const result = await postJson(
			'/api/v1/barcode/batches',
			{
				pecId: pendingGenerate.pec.id,
				year: data.year,
				quantity: pendingGenerate.quantity,
				templateId: selectedTemplateId ? Number(selectedTemplateId) : undefined,
				output: selectedOutput
			},
			'Failed to generate barcodes.'
		);
		responseData = result;
		if (responseData) {
			printOutputOpen = responseData.print.output === 'html_pdf';
			pendingGenerate = null;
			const qzSent = await sendRawPrintResponseToQz(responseData);
			if (responseData.print.output === 'html_pdf' || qzSent) await invalidateAll();
		}
	}

	async function reprintPecRange(input: {
		startSerial: number;
		endSerial: number;
		reason: string;
	}) {
		if (!pendingReprintPec) return;
		const result = await postJson(
			'/api/v1/barcode/ranges/reprint',
			{
				pecId: pendingReprintPec.id,
				year: data.year,
				startSerial: input.startSerial,
				endSerial: input.endSerial,
				templateId: selectedTemplateId ? Number(selectedTemplateId) : undefined,
				output: selectedOutput,
				reason: input.reason
			},
			'Reprint range failed.'
		);
		responseData = result;
		if (responseData) {
			printOutputOpen = responseData.print.output === 'html_pdf';
			pendingReprintPec = null;
			await sendRawPrintResponseToQz(responseData);
		}
	}

	async function reprintPecSingle(input: { serial: number; reason: string }) {
		if (!pendingReprintPec) return;
		const result = await postJson(
			'/api/v1/barcode/ranges/reprint',
			{
				pecId: pendingReprintPec.id,
				year: data.year,
				startSerial: input.serial,
				endSerial: input.serial,
				templateId: selectedTemplateId ? Number(selectedTemplateId) : undefined,
				output: selectedOutput,
				reason: input.reason
			},
			'Single barcode reprint failed.'
		);
		responseData = result;
		if (responseData) {
			printOutputOpen = responseData.print.output === 'html_pdf';
			pendingReprintPec = null;
			await sendRawPrintResponseToQz(responseData);
		}
	}

	function openReserveOffline(pec: (typeof data.pecs)[number]) {
		reservePec = pec;
		message = '';
	}

	function closeReserveOffline() {
		reservePec = null;
	}

	async function reserveOffline(event: SubmitEvent) {
		event.preventDefault();
		if (!reservePec) return;
		const form = new FormData(event.currentTarget as HTMLFormElement);
		const result = await postJson(
			'/api/v1/barcode/ranges/reserve-offline',
			{
				pecId: reservePec.id,
				year: data.year,
				startSerial: Number(form.get('startSerial')),
				endSerial: Number(form.get('endSerial')),
				reason: String(form.get('reason') ?? '')
			},
			'Failed to reserve offline range.'
		);
		if (result !== null) {
			const startSerial = Number(form.get('startSerial'));
			const endSerial = Number(form.get('endSerial'));
			const messagePec = reservePec;
			responseData = null;
			printOutputOpen = false;
			closeReserveOffline();
			message = messagePec
				? `Manual PEC code skip saved: ${barcodeValue(messagePec.code, startSerial)} to ${barcodeValue(messagePec.code, endSerial)} skipped.`
				: 'Manual PEC code skip saved.';
			await invalidateAll();
		}
	}

	function openRecentReprint(run: (typeof data.recentPrintRuns)[number]) {
		applySavedBarcodeOutputDefaults();
		pendingRecentReprint = { run };
		pendingGenerate = null;
		pendingReprintPec = null;
		responseData = null;
		printOutputOpen = false;
		message = '';
	}

	function cancelRecentReprint() {
		pendingRecentReprint = null;
	}

	async function reprintRecentRange(input: {
		startSerial: number;
		endSerial: number;
		reason: string;
	}) {
		if (!pendingRecentReprint) return;
		const run = pendingRecentReprint.run;
		const result = await postJson(
			'/api/v1/barcode/ranges/reprint',
			{
				pecId: run.pecId,
				year: run.year,
				startSerial: input.startSerial,
				endSerial: input.endSerial,
				templateId: selectedTemplateId ? Number(selectedTemplateId) : undefined,
				output: selectedOutput,
				reason: input.reason
			},
			'Reprint range failed.'
		);
		responseData = result;
		if (responseData) {
			printOutputOpen = responseData.print.output === 'html_pdf';
			pendingRecentReprint = null;
			await sendRawPrintResponseToQz(responseData);
		}
	}

	async function reprintRecentSingle(input: { serial: number; reason: string }) {
		if (!pendingRecentReprint) return;
		const run = pendingRecentReprint.run;
		const result = await postJson(
			'/api/v1/barcode/ranges/reprint',
			{
				pecId: run.pecId,
				year: run.year,
				startSerial: input.serial,
				endSerial: input.serial,
				templateId: selectedTemplateId ? Number(selectedTemplateId) : undefined,
				output: selectedOutput,
				reason: input.reason
			},
			'Single barcode reprint failed.'
		);
		responseData = result;
		if (responseData) {
			printOutputOpen = responseData.print.output === 'html_pdf';
			pendingRecentReprint = null;
			await sendRawPrintResponseToQz(responseData);
		}
	}

	async function loadQzPrinters() {
		qzBusy = true;
		qzMessage = 'Checking QZ Tray printers...';
		qzDefaultMessage = 'Checking QZ Tray printers...';
		try {
			const [printers, defaultPrinter] = await Promise.all([
				listQzPrinters(),
				getDefaultQzPrinter().catch(() => '')
			]);
			qzPrinters = printers;
			if (!qzDefaults.zpl.printer) qzDefaults.zpl.printer = defaultPrinter || printers[0] || '';
			if (!qzDefaults.epl.printer) qzDefaults.epl.printer = defaultPrinter || printers[0] || '';
			applyOutputDefaults(selectedOutput);
			const loadedMessage = printers.length
				? 'QZ Tray printers loaded.'
				: 'QZ Tray is reachable, but no printers were reported.';
			qzMessage = loadedMessage;
			qzDefaultMessage = loadedMessage;
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'QZ Tray printer lookup failed.';
			qzMessage = errorMessage;
			qzDefaultMessage = errorMessage;
		} finally {
			qzBusy = false;
		}
	}

	async function sendRawPrintToQz() {
		if (!responseData) return;
		await sendRawPrintResponseToQz(responseData);
	}

	async function sendRawPrintResponseToQz(printResponse: PrintResponse) {
		if (printResponse.print.output === 'html_pdf') return false;
		applyOutputDefaults(printResponse.print.output);
		if (!selectedQzPrinter) {
			qzMessage = 'Select a QZ printer before sending raw printer commands.';
			return false;
		}

		qzBusy = true;
		qzMessage = `Sending ${printResponse.print.output.toUpperCase()} to ${selectedQzPrinter}...`;
		try {
			await printRawBarcode({
				printerName: selectedQzPrinter,
				language: printResponse.print.output,
				data: printResponse.print.content,
				jobName: `VCMS ${printResponse.barcodes.length} barcode(s)`
			});
			qzMessage = `Sent ${printResponse.barcodes.length} barcode(s) to ${selectedQzPrinter}.`;
			return true;
		} catch (error) {
			qzMessage = error instanceof Error ? error.message : 'QZ Tray print failed.';
			return false;
		} finally {
			qzBusy = false;
		}
	}

	function printBrowserOutput() {
		applyBrowserPrintProfile(qzDefaults.browserPrint.profile);
		window.print();
	}

	function openQzDefaultPanel() {
		qzDefaultPanelOpen = true;
		qzDefaultMessage = '';
		void hydrateQzDefaultsFromProfileIfNeeded();
	}

	function closeQzDefaultPanel() {
		qzDefaultPanelOpen = false;
	}

	function togglePrintOutput() {
		printOutputOpen = !printOutputOpen;
	}

	async function saveQzDefaults() {
		const nextDefaults = snapshotQzDefaults();
		persistLocalQzDefaults(nextDefaults);
		selectedOutput = nextDefaults.defaultOutput;
		applyOutputDefaults(selectedOutput);
		try {
			await saveUserPrintPreferences(nextDefaults);
			qzDefaultMessage =
				'Defaults saved for this browser and your VCMS user profile fallback.';
		} catch (error) {
			qzDefaultMessage =
				error instanceof Error
					? `Browser defaults saved, but user profile fallback was not saved: ${error.message}`
					: 'Browser defaults saved, but user profile fallback was not saved.';
		}
	}

	async function clearQzDefaults() {
		localStorage.removeItem(qzDefaultsStorageKey);
		qzDefaults = normalizeQzDefaults(emptyQzDefaults);
		applyOutputDefaults(selectedOutput);
		try {
			await saveUserPrintPreferences(emptyQzDefaults);
			qzDefaultMessage = 'Defaults cleared for this browser and your VCMS user profile.';
		} catch (error) {
			qzDefaultMessage =
				error instanceof Error
					? `Browser defaults cleared, but user profile fallback was not cleared: ${error.message}`
					: 'Browser defaults cleared, but user profile fallback was not cleared.';
		}
	}

	async function testSamplePrint(output: RawOutput) {
		const defaults = qzDefaults[output];
		if (!defaults.printer) {
			qzDefaultMessage = `Select a ${output.toUpperCase()} printer before testing.`;
			return;
		}
		qzBusy = true;
		qzDefaultMessage = `Sending ${output.toUpperCase()} sample to ${defaults.printer}...`;
		try {
			await printRawBarcode({
				printerName: defaults.printer,
				language: output,
				data: renderSampleBarcode(output, defaults.templateId),
				jobName: `VCMS ${output.toUpperCase()} sample barcode`
			});
			qzDefaultMessage = `Sample barcode sent to ${defaults.printer}.`;
		} catch (error) {
			qzDefaultMessage = error instanceof Error ? error.message : 'QZ Tray sample print failed.';
		} finally {
			qzBusy = false;
		}
	}

	function readQzDefaults(raw: string): QzDefaultSettings {
		try {
			return normalizeQzDefaults(JSON.parse(raw));
		} catch {
			return normalizeQzDefaults(emptyQzDefaults);
		}
	}

	function readLocalQzDefaults() {
		const raw = localStorage.getItem(qzDefaultsStorageKey);
		return raw ? readQzDefaults(raw) : null;
	}

	function persistLocalQzDefaults(settings: QzDefaultSettings) {
		localStorage.setItem(qzDefaultsStorageKey, JSON.stringify(settings));
	}

	function hasMeaningfulQzDefaults(settings: QzDefaultSettings) {
		return Boolean(
				settings.zpl.printer ||
				settings.zpl.templateId ||
				settings.epl.printer ||
				settings.epl.templateId ||
				settings.defaultOutput !== 'html_pdf' ||
				settings.browserPrint.profile !== 'a4'
		);
	}

	function normalizeQzDefaults(input: unknown): QzDefaultSettings {
		const parsed = input as Partial<
			Record<RawOutput, Partial<{ printer: string; templateId: string }>> & {
				defaultOutput?: BarcodeOutput;
				browserPrint?: Partial<{ profile: BrowserPrintProfile }>;
			}
		>;
		const defaultOutput =
			parsed?.defaultOutput === 'zpl' || parsed?.defaultOutput === 'epl'
				? parsed.defaultOutput
				: 'html_pdf';
		return {
			defaultOutput,
			zpl: {
				printer: typeof parsed?.zpl?.printer === 'string' ? parsed.zpl.printer : '',
				templateId: typeof parsed?.zpl?.templateId === 'string' ? parsed.zpl.templateId : ''
			},
			epl: {
				printer: typeof parsed?.epl?.printer === 'string' ? parsed.epl.printer : '',
				templateId: typeof parsed?.epl?.templateId === 'string' ? parsed.epl.templateId : ''
			},
			browserPrint: {
				profile: parsed?.browserPrint?.profile === 'a5' ? 'a5' : 'a4'
			}
		};
	}

	function snapshotQzDefaults(): QzDefaultSettings {
		return {
			defaultOutput: qzDefaults.defaultOutput,
			zpl: { printer: qzDefaults.zpl.printer, templateId: qzDefaults.zpl.templateId },
			epl: { printer: qzDefaults.epl.printer, templateId: qzDefaults.epl.templateId },
			browserPrint: { profile: qzDefaults.browserPrint.profile }
		};
	}

	async function saveUserPrintPreferences(printPreferences: QzDefaultSettings) {
		const response = await fetch('/api/v1/users/profile/print-preferences', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ printPreferences })
		});
		const json = await response.json().catch(() => ({}));
		if (!response.ok) {
			throw new Error(json.error?.message ?? 'User profile save failed.');
		}
	}

	async function loadUserPrintPreferences() {
		const response = await fetch('/api/v1/users/profile/print-preferences');
		const json = await response.json().catch(() => ({}));
		if (!response.ok) {
			throw new Error(json.error?.message ?? 'User profile preferences could not be loaded.');
		}
		return normalizeQzDefaults(json.data);
	}

	async function hydrateQzDefaultsFromProfileIfNeeded() {
		const localDefaults = readLocalQzDefaults();
		if (localDefaults && hasMeaningfulQzDefaults(localDefaults)) {
			qzDefaults = localDefaults;
			applyOutputDefaults(selectedOutput);
			return;
		}

		try {
			const profileDefaults = await loadUserPrintPreferences();
			if (!hasMeaningfulQzDefaults(profileDefaults)) return;
			qzDefaults = profileDefaults;
			persistLocalQzDefaults(profileDefaults);
			selectedOutput = profileDefaults.defaultOutput;
			applyOutputDefaults(selectedOutput);
			qzDefaultMessage = 'Loaded defaults from your VCMS user profile.';
		} catch (error) {
			qzDefaultMessage =
				error instanceof Error ? error.message : 'User profile preferences could not be loaded.';
		}
	}

	function printerOptionsFor(savedPrinter: string) {
		return Array.from(new Set([savedPrinter, ...qzPrinters].filter(Boolean)));
	}

	function applyOutputDefaults(output: typeof selectedOutput) {
		if (output === 'html_pdf') {
			selectedQzPrinter = '';
			return;
		}
		selectedQzPrinter = qzDefaults[output].printer;
		selectedTemplateId = qzDefaults[output].templateId;
	}

	function applySavedBarcodeOutputDefaults() {
		selectedOutput = qzDefaults.defaultOutput;
		applyOutputDefaults(selectedOutput);
	}

	function templatesFor(output: RawOutput) {
		return data.templates.filter((template) => template.type === output);
	}

	function actionPrinterOptions(output: typeof selectedOutput) {
		if (output === 'html_pdf') return [];
		return printerOptionsFor(qzDefaults[output].printer || selectedQzPrinter);
	}

	function renderSampleBarcode(output: RawOutput, templateId: string) {
		const template = data.templates.find((item) => String(item.id) === templateId);
		const widthMm = template?.widthMm ?? 50;
		const heightMm = template?.heightMm ?? 25;
		const dpi = template?.dpi ?? 203;
		const layout = template?.layout as
			| { barcodeX?: number; barcodeY?: number; textY?: number }
			| undefined;
		const barcodeHeight = template?.barcodeHeight ?? 80;
		const y = layout?.barcodeY ?? 24;
		const textY = layout?.textY ?? y + barcodeHeight + 12;
		const widthDots = Math.round((widthMm / 25.4) * dpi);
		const heightDots = Math.round((heightMm / 25.4) * dpi);
		const code128Modules = 35 + sampleBarcode.length * 11;
		const moduleWidth = code128Modules * 2 <= widthDots ? 2 : 1;
		const x =
			layout?.barcodeX ??
			Math.max(0, Math.floor((widthDots - code128Modules * moduleWidth) / 2));
		if (output === 'zpl') {
			return [
				'^XA',
				'^CI28',
				`^PW${widthDots}`,
				`^LL${heightDots}`,
				`^BY${moduleWidth},2,80`,
				`^FO${x},${y}^BCN,${barcodeHeight},N,N,N`,
				`^FD${sampleBarcode}^FS`,
				`^FO${x},${textY}^A0N,28,28^FD${sampleBarcode}^FS`,
				'^XZ'
			].join('\r\n');
		}
		return [
			'N',
			`q${widthDots}`,
			`Q${heightDots},24`,
			`B${x},${y},0,1,${moduleWidth},${moduleWidth * 2},${barcodeHeight},N,"${sampleBarcode}"`,
			`A${x},${textY},0,3,1,1,N,"${sampleBarcode}"`,
			'P1'
		].join('\r\n');
	}

	function applyBrowserPrintProfile(profile: BrowserPrintProfile) {
		let style = document.getElementById('vcms-browser-print-profile') as HTMLStyleElement | null;
		if (!style) {
			style = document.createElement('style');
			style.id = 'vcms-browser-print-profile';
			document.head.append(style);
		}
		const pageSize = profile === 'a5' ? 'A5 portrait' : 'A4 portrait';
		const margin = profile === 'a5' ? '8mm' : '10mm';
		style.textContent = `@media print { @page { size: ${pageSize}; margin: ${margin}; } }`;
	}
</script>

<h1>Barcode Printing Dashboard</h1>

<section class="card">
	<form class="filter-grid" method="GET">
		<label class="filter-control">
			<span>PEC Search</span>
			<input bind:value={search} placeholder="PEC code or name" />
		</label>
		<label class="filter-control">
			<span>Template</span>
			<select bind:value={selectedTemplateId}>
				<option value="">Default</option>
				{#each data.templates as template (template.id)}
					<option value={template.id}>{template.name}</option>
				{/each}
			</select>
		</label>
		<label class="filter-control">
			<span>Output</span>
			<select value={selectedOutput} onchange={setSelectedOutput}>
				<option value="html_pdf">Browser/PDF</option>
				<option value="zpl">ZPL</option>
				<option value="epl">EPL</option>
			</select>
		</label>
		<div class="filter-action">
			<button type="button" class="secondary" onclick={openQzDefaultPanel}
				>Set Default Printer</button
			>
		</div>
	</form>
	{#if message}<p
			class={message.includes('failed') || message.includes('Failed') ? 'error' : 'success'}
		>
			{message}
		</p>{/if}
</section>

<section class="card">
	<h2>PECs</h2>
	<table>
		<thead>
			<tr>
				<th>PEC</th>
				<th>Year</th>
				<th>Last</th>
				<th>Next</th>
				<th>Generate</th>
				<th>Reprint</th>
				<th>Manual PEC Code Skip</th>
			</tr>
		</thead>
		<tbody>
			{#each filteredPecs as pec (pec.id)}
				<tr>
					<td>{String(pec.code).padStart(2, '0')} - {pec.name}</td>
					<td>{String(pec.year).padStart(2, '0')}</td>
					<td
						>{pec.lastGeneratedSerial > 0
							? barcodeValue(pec.code, pec.lastGeneratedSerial)
							: 'None yet'}</td
					>
					<td>{barcodeValue(pec.code, pec.nextSerial)}</td>
					<td>
						<form class="inline-form" onsubmit={(event) => prepareGenerate(event, pec)}>
							<input
								name="quantity"
								type="number"
								min="1"
								max="1000"
								value="50"
								aria-label="Quantity"
							/>
							<button type="submit" disabled={pec.locked}>Generate</button>
						</form>
					</td>
					<td>
						<button
							type="button"
							class="secondary"
							disabled={!pec.printedRanges.length}
							title={!pec.printedRanges.length
								? 'No printed barcodes exist for this PEC/year.'
								: 'Reprint an already printed barcode range'}
							onclick={() => openReprintRange(pec)}>Reprint</button
						>
					</td>
					<td>
						<div class="button-row">
							<button type="button" class="secondary" onclick={() => openReserveOffline(pec)}
								>Manual PEC Code Skip</button
							>
							{#if pec.codeSkipHistory.length}
								<button
									type="button"
									class="icon-button"
									aria-label={`View ${pec.codeSkipHistory.length} manual PEC code skip record(s)`}
									title={`${pec.codeSkipHistory.length} manual PEC code skip record(s)`}
									onclick={() => toggleSkipHistory(pec.id)}
								>
									↷ {pec.codeSkipHistory.length}
								</button>
							{/if}
						</div>
					</td>
				</tr>
				{#if pendingGenerate?.pec.id === pec.id}
					<tr class="confirmation-row">
						<td colspan="7">
							<section class="confirm-panel">
								<h3>Confirm Barcode Print Range</h3>
								<p>
									Generating <strong>{pendingGenerate.quantity}</strong> barcode(s) for
									<strong>{String(pec.code).padStart(2, '0')} - {pec.name}</strong>.
								</p>
								<p class="range-preview">
									{barcodeValue(pec.code, pendingGenerate.startSerial)}
									<span>to</span>
									{barcodeValue(pec.code, pendingGenerate.endSerial)}
								</p>
								<p class="muted">
									Clicking Print will allocate this range permanently and create the printer output.
									Cancel if the PEC, year, quantity, template, or output mode is wrong.
								</p>
								<section class="print-action-settings">
									<h4>Print Settings For This Action</h4>
									<div class="action-settings-grid">
										<label>
											Mode
											<select value={selectedOutput} onchange={setActionOutput}>
												<option value="html_pdf">Browser/PDF</option>
												<option value="zpl">ZPL</option>
												<option value="epl">EPL</option>
											</select>
										</label>
										{#if selectedOutput === 'zpl' || selectedOutput === 'epl'}
											<label>
												Printer
												<select bind:value={selectedQzPrinter}>
													<option value="">Select printer</option>
													{#each actionPrinterOptions(selectedOutput) as printer (printer)}
														<option value={printer}>{printer}</option>
													{/each}
												</select>
											</label>
										{:else}
											<p class="muted">Browser/PDF uses the browser print dialog.</p>
										{/if}
									</div>
									<div class="button-row">
										<button type="button" class="secondary" disabled={qzBusy} onclick={loadQzPrinters}
											>Find QZ Printers</button
										>
										<button type="button" class="secondary" onclick={openQzDefaultPanel}
											>Manage Defaults</button
										>
									</div>
								</section>
								<div class="button-row">
									<button type="button" onclick={confirmGenerateBatch}>Print</button>
									<button type="button" class="secondary" onclick={cancelGenerate}>Cancel</button>
								</div>
							</section>
						</td>
					</tr>
				{/if}
				{#if pendingReprintPec?.id === pec.id}
					<tr class="confirmation-row">
						<td colspan="7">
							<ReprintCodePanel
								pecCode={pec.code}
								pecName={pec.name}
								year={data.year}
								printedRanges={pec.printedRanges}
								defaultStartSerial={pec.printedRanges[0]?.startSerial ?? 1}
								defaultEndSerial={pec.printedRanges[0]?.endSerial ?? 1}
								minSerial={Math.min(...pec.printedRanges.map((range) => range.startSerial))}
								maxSerial={Math.max(...pec.printedRanges.map((range) => range.endSerial))}
								onRangePrint={reprintPecRange}
								onSinglePrint={reprintPecSingle}
								onCancel={cancelReprintRange}
							>
								<section class="print-action-settings">
									<h4>Print Settings For This Reprint</h4>
									<div class="action-settings-grid">
										<label>
											Mode
											<select value={selectedOutput} onchange={setActionOutput}>
												<option value="html_pdf">Browser/PDF</option>
												<option value="zpl">ZPL</option>
												<option value="epl">EPL</option>
											</select>
										</label>
										{#if selectedOutput === 'zpl' || selectedOutput === 'epl'}
											<label>
												Printer
												<select bind:value={selectedQzPrinter}>
													<option value="">Select printer</option>
													{#each actionPrinterOptions(selectedOutput) as printer (printer)}
														<option value={printer}>{printer}</option>
													{/each}
												</select>
											</label>
										{:else}
											<p class="muted">Browser/PDF uses the browser print dialog.</p>
										{/if}
									</div>
									<div class="button-row">
										<button type="button" class="secondary" disabled={qzBusy} onclick={loadQzPrinters}
											>Find QZ Printers</button
										>
										<button type="button" class="secondary" onclick={openQzDefaultPanel}
											>Manage Defaults</button
										>
									</div>
								</section>
							</ReprintCodePanel>
						</td>
					</tr>
				{/if}
				{#if expandedSkipHistoryPecId === pec.id}
					<tr class="confirmation-row">
						<td colspan="7">
							<section class="history-panel">
								<h3>Manual PEC Code Skip History</h3>
								<p class="muted">
									These skipped ranges are preserved so future generated barcode ranges do not reuse
									the same PEC codes.
								</p>
								<table>
									<thead>
										<tr>
											<th>Skipped Codes</th>
											<th>Qty</th>
											<th>Reason</th>
											<th>Created</th>
										</tr>
									</thead>
									<tbody>
										{#each pec.codeSkipHistory as skip (skip.id)}
											<tr>
												<td>
													{skip.startSerial ? barcodeValue(pec.code, skip.startSerial) : '—'}
													to
													{skip.endSerial ? barcodeValue(pec.code, skip.endSerial) : '—'}
												</td>
												<td>{skip.quantity}</td>
												<td>{skip.reason}</td>
												<td>{new Date(skip.createdAt).toLocaleString()}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</section>
						</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
</section>

{#if reservePec}
	<div class="scrim" role="presentation" onclick={closeReserveOffline}></div>
	<div class="slideout" aria-modal="true" role="dialog" aria-labelledby="reserve-offline-title">
		<header class="slideout-header">
			<div>
				<p class="eyebrow">Manual PEC Code Skip</p>
				<h2 id="reserve-offline-title">
					{String(reservePec.code).padStart(2, '0')} - {reservePec.name}
				</h2>
			</div>
			<button type="button" class="secondary" onclick={closeReserveOffline}>Close</button>
		</header>

		<section class="instructions">
			<h3>What this means</h3>
			<p>
				Use this when serial numbers for this PEC/year must be skipped because stickers were issued
				manually, damaged, lost, or otherwise should not be generated again.
			</p>
			<p>
				The system will mark the selected serial range as skipped so future generated print ranges
				move past those numbers. This prevents duplicate PEC barcode values.
			</p>
			<p>
				Current next barcode for this PEC/year is
				<strong>{barcodeValue(reservePec.code, reservePec.nextSerial)}</strong>.
			</p>

			<h3>How to use</h3>
			<ol>
				<li>Confirm the PEC and barcode year are correct.</li>
				<li>Enter the first and last serial number that should be skipped.</li>
				<li>
					Write a clear reason, such as damaged sticker sheet, manual issue, register reference, or
					printer failure note.
				</li>
				<li>Submit only after checking the numbers; overlapping ranges are rejected.</li>
			</ol>
		</section>

		<form class="slideout-form" onsubmit={reserveOffline}>
			<label
				>PEC <input
					value={`${String(reservePec.code).padStart(2, '0')} - ${reservePec.name}`}
					readonly
				/></label
			>
			<label>Barcode Year YY <input value={String(data.year).padStart(2, '0')} readonly /></label>
			<label
				>Start Serial
				<input
					name="startSerial"
					type="number"
					min="1"
					max="999999"
					value={reservePec.nextSerial}
					required
				/></label
			>
			<label
				>End Serial
				<input
					name="endSerial"
					type="number"
					min="1"
					max="999999"
					value={reservePec.nextSerial}
					required
				/></label
			>
			<label
				>Reason
				<textarea
					name="reason"
					rows="4"
					required
					placeholder="Example: 25 stickers skipped because sheet was damaged before use"
				></textarea>
			</label>
			<button type="submit">Save Manual PEC Code Skip</button>
		</form>
	</div>
{/if}

{#if qzDefaultPanelOpen}
	<div class="scrim" role="presentation" onclick={closeQzDefaultPanel}></div>
	<div class="slideout" aria-modal="true" role="dialog" aria-labelledby="qz-defaults-title">
		<header class="slideout-header">
			<div>
				<p class="eyebrow">QZ Tray Workstation Defaults</p>
				<h2 id="qz-defaults-title">Default Barcode Printer</h2>
			</div>
			<button type="button" class="secondary" onclick={closeQzDefaultPanel}>Close</button>
		</header>

		<section class="instructions">
			<p>
				These settings are saved in this browser on this workstation and copied to your VCMS
				user profile. This browser copy is used first; your profile is used as a fallback when
				you sign in from a browser profile that has no local defaults yet.
			</p>
			<div class="button-row">
				<button type="button" class="secondary" disabled={qzBusy} onclick={loadQzPrinters}>
					Find QZ Printers
				</button>
				<button type="button" onclick={saveQzDefaults}>Save Defaults</button>
				<button type="button" class="secondary" onclick={clearQzDefaults}>Clear Defaults</button>
			</div>
			{#if qzDefaultMessage}<p class="muted">{qzDefaultMessage}</p>{/if}
		</section>

			<div class="default-printer-grid">
			<section class="default-printer-panel">
				<h3>Barcode Output</h3>
				<label>
					Default Mode
					<select bind:value={qzDefaults.defaultOutput}>
						<option value="html_pdf">Browser/PDF</option>
						<option value="zpl">ZPL</option>
						<option value="epl">EPL</option>
					</select>
				</label>
			</section>

			<section class="default-printer-panel">
				<h3>Browser Print</h3>
				<label>
					Paper Profile
					<select bind:value={qzDefaults.browserPrint.profile}>
						<option value="a4">A4 portrait</option>
						<option value="a5">A5 portrait</option>
					</select>
				</label>
			</section>

			<section class="default-printer-panel">
				<h3>ZPL</h3>
				<label>
					Printer
					<select bind:value={qzDefaults.zpl.printer}>
						<option value="">Select printer</option>
						{#each printerOptionsFor(qzDefaults.zpl.printer) as printer (printer)}
							<option value={printer}>{printer}</option>
						{/each}
					</select>
				</label>
				<label>
					Template
					<select bind:value={qzDefaults.zpl.templateId}>
						<option value="">Default 50x25mm</option>
						{#each templatesFor('zpl') as template (template.id)}
							<option value={String(template.id)}>{template.name}</option>
						{/each}
					</select>
				</label>
				<button
					type="button"
					class="secondary"
					disabled={qzBusy}
					onclick={() => testSamplePrint('zpl')}
				>
					Test Sample Barcode
				</button>
			</section>

			<section class="default-printer-panel">
				<h3>EPL</h3>
				<label>
					Printer
					<select bind:value={qzDefaults.epl.printer}>
						<option value="">Select printer</option>
						{#each printerOptionsFor(qzDefaults.epl.printer) as printer (printer)}
							<option value={printer}>{printer}</option>
						{/each}
					</select>
				</label>
				<label>
					Template
					<select bind:value={qzDefaults.epl.templateId}>
						<option value="">Default 50x25mm</option>
						{#each templatesFor('epl') as template (template.id)}
							<option value={String(template.id)}>{template.name}</option>
						{/each}
					</select>
				</label>
				<button
					type="button"
					class="secondary"
					disabled={qzBusy}
					onclick={() => testSamplePrint('epl')}
				>
					Test Sample Barcode
				</button>
			</section>
		</div>
	</div>
{/if}

{#if responseData}
	<section class="card print-output">
		<header class="collapsible-header">
			<div>
				<h2>Print Output</h2>
				<p>
					{responseData.barcodes.length} barcode(s){#if responseData.startSerial && responseData.endSerial}:
						serial {responseData.startSerial}–{responseData.endSerial}{/if}
				</p>
			</div>
			<button type="button" class="secondary" onclick={togglePrintOutput}>
				{printOutputOpen ? 'Hide Output' : 'Show Output'}
			</button>
		</header>
		{#if responseData.print.output !== 'html_pdf'}
			<div class="qz-panel">
				<p class="muted">
					QZ printer: <strong>{selectedQzPrinter || 'No workstation default selected'}</strong>
				</p>
				<div class="button-row">
					<button type="button" class="secondary" disabled={qzBusy} onclick={loadQzPrinters}>
						Find QZ Printers
					</button>
					<button type="button" class="secondary" onclick={openQzDefaultPanel}
						>Set Default Printer</button
					>
					<button type="button" disabled={qzBusy || !selectedQzPrinter} onclick={sendRawPrintToQz}>
						Send to QZ Tray
					</button>
				</div>
				{#if qzMessage}<p class="muted">{qzMessage}</p>{/if}
			</div>
		{/if}
		{#if printOutputOpen}
			{#if responseData.print.output === 'html_pdf'}
				<div class="labels">
					{#each responseData.print.content as label (label.value)}
						<div class="label"><img src={svgDataUri(label.svg)} alt={label.value} /></div>
					{/each}
				</div>
				<button onclick={printBrowserOutput}>Browser Print</button>
			{:else}
				<textarea rows="18" readonly>{responseData.print.content}</textarea>
			{/if}
		{/if}
	</section>
{/if}

<section class="card">
	<h2>Recent Print Runs</h2>
	<table>
		<thead>
			<tr>
				<th>PEC</th>
				<th>Year</th>
				<th>Range</th>
				<th>Qty</th>
				<th>Type</th>
				<th>Created</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each data.recentPrintRuns as run (run.id)}
				<tr>
					<td>{String(run.pecCode).padStart(2, '0')} - {run.pecName}</td>
					<td>{String(run.year).padStart(2, '0')}</td>
					<td>{run.startSerial ?? '—'}–{run.endSerial ?? '—'}</td>
					<td>{run.quantity}</td>
					<td>{run.type}</td>
					<td>{new Date(run.createdAt).toLocaleString()}</td>
					<td>
						<button type="button" class="secondary" onclick={() => openRecentReprint(run)}
							>Reprint</button
						>
					</td>
				</tr>
				{#if pendingRecentReprint?.run.id === run.id}
					<tr class="confirmation-row">
						<td colspan="7">
							<ReprintCodePanel
								pecCode={run.pecCode}
								pecName={run.pecName}
								year={run.year}
								defaultStartSerial={run.startSerial ?? 1}
								defaultEndSerial={run.endSerial ?? run.startSerial ?? 1}
								minSerial={run.startSerial ?? 1}
								maxSerial={run.endSerial ?? 999999}
								rangeReason="Reprint recent print run range"
								singleReason="Reprint one barcode from recent run"
								onRangePrint={reprintRecentRange}
								onSinglePrint={reprintRecentSingle}
								onCancel={cancelRecentReprint}
							>
								<section class="print-action-settings">
									<h4>Print Settings For This Reprint</h4>
									<div class="action-settings-grid">
										<label>
											Mode
											<select value={selectedOutput} onchange={setActionOutput}>
												<option value="html_pdf">Browser/PDF</option>
												<option value="zpl">ZPL</option>
												<option value="epl">EPL</option>
											</select>
										</label>
										{#if selectedOutput === 'zpl' || selectedOutput === 'epl'}
											<label>
												Printer
												<select bind:value={selectedQzPrinter}>
													<option value="">Select printer</option>
													{#each actionPrinterOptions(selectedOutput) as printer (printer)}
														<option value={printer}>{printer}</option>
													{/each}
												</select>
											</label>
										{:else}
											<p class="muted">Browser/PDF uses the browser print dialog.</p>
										{/if}
									</div>
									<div class="button-row">
										<button type="button" class="secondary" disabled={qzBusy} onclick={loadQzPrinters}
											>Find QZ Printers</button
										>
										<button type="button" class="secondary" onclick={openQzDefaultPanel}
											>Manage Defaults</button
										>
									</div>
								</section>
							</ReprintCodePanel>
						</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
</section>

<style>
	.filter-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(12rem, 1fr)) auto;
		gap: 0.8rem;
		align-items: end;
	}
	.filter-action {
		display: flex;
		align-items: end;
		min-height: 2.75rem;
	}
	.filter-control {
		display: grid;
		grid-template-rows: 1.25rem 2.75rem;
		gap: 0.3rem;
		min-width: 0;
	}
	.filter-control span {
		line-height: 1.25rem;
	}
	.filter-control input,
	.filter-control select {
		box-sizing: border-box;
		width: 100%;
		height: 2.75rem;
	}
	.inline-form {
		display: flex;
		gap: 0.4rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.inline-form input {
		max-width: 8rem;
	}
	.confirmation-row td {
		background: #f8fafc;
	}
	.history-panel {
		border: 1px solid #cbd5e1;
		border-radius: 0.75rem;
		background: white;
		padding: 1rem;
	}
	.history-panel h3 {
		margin-top: 0;
	}
	.confirm-panel {
		border: 1px solid #99f6e4;
		border-radius: 0.75rem;
		background: #f0fdfa;
		padding: 1rem;
	}
	.confirm-panel h3 {
		margin-top: 0;
	}
	.range-preview {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		align-items: center;
		font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
		font-size: 1.05rem;
		font-weight: 800;
	}
	.range-preview span {
		color: #64748b;
		font-family: inherit;
		font-weight: 600;
	}
	.button-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.secondary {
		background: #f8fafc;
		color: #0f172a;
		border-color: #cbd5e1;
	}
	.icon-button {
		background: #eff6ff;
		color: #1d4ed8;
		border-color: #bfdbfe;
		min-width: 3rem;
	}
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 10;
		background: rgb(15 23 42 / 45%);
	}
	.slideout {
		position: fixed;
		inset-block: 0;
		right: 0;
		z-index: 11;
		width: min(32rem, 100vw);
		overflow-y: auto;
		background: white;
		box-shadow: -1rem 0 2rem rgb(15 23 42 / 18%);
		padding: 1.25rem;
	}
	.slideout-header {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
		border-bottom: 1px solid #e2e8f0;
		padding-bottom: 1rem;
	}
	.slideout-header h2 {
		margin: 0.1rem 0 0;
	}
	.eyebrow {
		margin: 0;
		color: #0f766e;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.instructions {
		margin-block: 1rem;
		color: #334155;
	}
	.instructions h3 {
		color: #0f172a;
		margin-bottom: 0.25rem;
	}
	.instructions ol {
		padding-left: 1.25rem;
	}
	.slideout-form {
		display: grid;
		gap: 0.9rem;
	}
	.default-printer-grid {
		display: grid;
		gap: 1rem;
	}
	.default-printer-panel {
		display: grid;
		gap: 0.75rem;
		padding: 0.9rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
	}
	.default-printer-panel h3 {
		margin: 0;
	}
	.default-printer-panel label {
		display: grid;
		gap: 0.3rem;
	}
	.collapsible-header {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
		margin-bottom: 0.8rem;
	}
	.collapsible-header h2 {
		margin: 0;
	}
	.collapsible-header p {
		margin: 0.25rem 0 0;
	}
	.print-action-settings {
		display: grid;
		gap: 0.75rem;
		margin-block: 0.85rem;
		padding: 0.85rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
		background: #f8fafc;
	}
	.print-action-settings h4 {
		margin: 0;
	}
	.action-settings-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 0.75rem;
		align-items: end;
	}
	.action-settings-grid label {
		display: grid;
		gap: 0.3rem;
	}
	.labels {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
		gap: 0.5rem;
	}
	.label {
		border: 1px dashed #94a3b8;
		padding: 0.5rem;
		text-align: center;
	}
	.qz-panel {
		display: grid;
		gap: 0.75rem;
		margin-bottom: 0.9rem;
		padding: 0.85rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
		background: #f8fafc;
	}
	textarea {
		width: 100%;
		font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
	}
	@media (max-width: 760px) {
		.filter-grid {
			grid-template-columns: 1fr;
		}
		.filter-action {
			align-items: stretch;
		}
	}
</style>
