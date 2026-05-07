<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ReprintCodePanel from '$lib/components/barcode/ReprintCodePanel.svelte';

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

	let search = $state('');
	let selectedOutput = $state<'html_pdf' | 'zpl' | 'epl'>('html_pdf');
	let selectedTemplateId = $state('');
	let responseData = $state<PrintResponse | null>(null);
	let message = $state('');
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
		message = '';
	}

	function cancelGenerate() {
		pendingGenerate = null;
	}

	function toggleSkipHistory(pecId: number) {
		expandedSkipHistoryPecId = expandedSkipHistoryPecId === pecId ? null : pecId;
	}

	function openReprintRange(pec: (typeof data.pecs)[number]) {
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
		responseData = await postJson(
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
		if (responseData) {
			pendingGenerate = null;
			await invalidateAll();
		}
	}

	async function reprintPecRange(input: {
		startSerial: number;
		endSerial: number;
		reason: string;
	}) {
		if (!pendingReprintPec) return;
		responseData = await postJson(
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
		if (responseData) pendingReprintPec = null;
	}

	async function reprintPecSingle(input: { serial: number; reason: string }) {
		if (!pendingReprintPec) return;
		responseData = await postJson(
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
		if (responseData) pendingReprintPec = null;
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
			closeReserveOffline();
			message = messagePec
				? `Manual PEC code skip saved: ${barcodeValue(messagePec.code, startSerial)} to ${barcodeValue(messagePec.code, endSerial)} skipped.`
				: 'Manual PEC code skip saved.';
			await invalidateAll();
		}
	}

	function openRecentReprint(run: (typeof data.recentPrintRuns)[number]) {
		pendingRecentReprint = { run };
		pendingGenerate = null;
		pendingReprintPec = null;
		responseData = null;
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
		responseData = await postJson(
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
		if (responseData) pendingRecentReprint = null;
	}

	async function reprintRecentSingle(input: { serial: number; reason: string }) {
		if (!pendingRecentReprint) return;
		const run = pendingRecentReprint.run;
		responseData = await postJson(
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
		if (responseData) pendingRecentReprint = null;
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
			<select bind:value={selectedOutput}>
				<option value="html_pdf">Browser/PDF</option>
				<option value="zpl">ZPL</option>
				<option value="epl">EPL</option>
			</select>
		</label>
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
						<button type="button" class="secondary" onclick={() => openReprintRange(pec)}
							>Reprint</button
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
								defaultStartSerial={Math.max(1, pec.lastGeneratedSerial || 1)}
								defaultEndSerial={Math.max(1, pec.lastGeneratedSerial || 1)}
								onRangePrint={reprintPecRange}
								onSinglePrint={reprintPecSingle}
								onCancel={cancelReprintRange}
							/>
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

{#if responseData}
	<section class="card print-output">
		<h2>Print Output</h2>
		<p>
			{responseData.barcodes.length} barcode(s){#if responseData.startSerial && responseData.endSerial}:
				serial {responseData.startSerial}–{responseData.endSerial}{/if}
		</p>
		{#if responseData.print.output === 'html_pdf'}
			<div class="labels">
				{#each responseData.print.content as label (label.value)}
					<div class="label"><img src={svgDataUri(label.svg)} alt={label.value} /></div>
				{/each}
			</div>
			<button onclick={() => print()}>Browser Print</button>
		{:else}
			<textarea rows="18" readonly>{responseData.print.content}</textarea>
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
							/>
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
		grid-template-columns: repeat(3, minmax(12rem, 1fr));
		gap: 0.8rem;
		align-items: end;
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
	textarea {
		width: 100%;
		font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
	}
	@media (max-width: 760px) {
		.filter-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
