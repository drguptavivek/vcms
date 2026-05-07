<script lang="ts">
	let { data } = $props();
	type BarcodeResponse = {
		batch: { id: string };
		startSerial: number;
		endSerial: number;
		barcodes: string[];
		print:
			| { output: 'html_pdf'; content: Array<{ value: string; svg: string }> }
			| { output: 'zpl' | 'epl'; content: string };
	};

	let responseData = $state<BarcodeResponse | null>(null);
	let message = $state('');
	const svgDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

	async function printBatch(event: SubmitEvent) {
		event.preventDefault();
		const form = new FormData(event.currentTarget as HTMLFormElement);
		const response = await fetch('/api/v1/barcode/batches', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				pecId: Number(form.get('pecId')),
				year: Number(form.get('year')),
				quantity: Number(form.get('quantity')),
				templateId: form.get('templateId') ? Number(form.get('templateId')) : undefined,
				output: form.get('output')
			})
		});
		const json = await response.json();
		if (response.ok) {
			responseData = json.data;
			message = '';
		} else {
			message = json.error?.message ?? 'Failed to print batch.';
		}
	}
</script>

<h1>Print Barcode Batch</h1>
<section class="card">
	{#if message}<p class="error">{message}</p>{/if}
	<form class="grid" onsubmit={printBatch}>
		<label
			>PEC <select name="pecId"
				>{#each data.pecs as pec (pec.id)}<option value={pec.id}
						>{String(pec.code).padStart(2, '0')} - {pec.name}</option
					>{/each}</select
			></label
		>
		<label
			>Year YY <input
				name="year"
				type="number"
				min="0"
				max="99"
				value={new Date().getFullYear() % 100}
				required
			/></label
		>
		<label
			>Quantity <input
				name="quantity"
				type="number"
				min="1"
				max="1000"
				value="10"
				required
			/></label
		>
		<label
			>Template <select name="templateId"
				><option value="">Default</option>{#each data.templates as template (template.id)}<option
						value={template.id}>{template.name}</option
					>{/each}</select
			></label
		>
		<label
			>Output <select name="output"
				><option value="html_pdf">Browser/PDF</option><option value="zpl">ZPL</option><option
					value="epl">EPL</option
				></select
			></label
		>
		<button type="submit">Generate</button>
	</form>
</section>

{#if responseData}
	<section class="card">
		<h2>Generated {responseData.barcodes.length} Barcodes</h2>
		<p>Range: {responseData.startSerial}–{responseData.endSerial}</p>
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

<style>
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
</style>
