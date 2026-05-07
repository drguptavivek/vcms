<script lang="ts">
	let { data } = $props();
	let message = $state('');

	async function createTemplate(event: SubmitEvent) {
		event.preventDefault();
		const form = new FormData(event.currentTarget as HTMLFormElement);
		const response = await fetch('/api/v1/printer-templates', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: String(form.get('name')),
				type: form.get('type'),
				widthMm: Number(form.get('widthMm')),
				heightMm: Number(form.get('heightMm')),
				dpi: Number(form.get('dpi')),
				barcodeHeight: Number(form.get('barcodeHeight')),
				layout: {
					barcodeX: Number(form.get('barcodeX')),
					barcodeY: Number(form.get('barcodeY')),
					textY: Number(form.get('textY'))
				}
			})
		});
		if (response.ok) location.reload();
		else message = (await response.json()).error?.message ?? 'Failed to create template.';
	}
</script>

<h1>Printer Templates</h1>
<section class="card">
	<h2>Create Template</h2>
	{#if message}<p class="error">{message}</p>{/if}
	<form class="grid" onsubmit={createTemplate}>
		<label>Name <input name="name" value="50x25 ZPL" required /></label>
		<label
			>Type <select name="type"
				><option value="html_pdf">Browser/PDF</option><option value="zpl">ZPL</option><option
					value="epl">EPL</option
				></select
			></label
		>
		<label>Width mm <input name="widthMm" type="number" value="50" required /></label>
		<label>Height mm <input name="heightMm" type="number" value="25" required /></label>
		<label>DPI <input name="dpi" type="number" value="203" required /></label>
		<label>Barcode Height <input name="barcodeHeight" type="number" value="80" required /></label>
		<label>Barcode X <input name="barcodeX" type="number" value="40" /></label>
		<label>Barcode Y <input name="barcodeY" type="number" value="24" /></label>
		<label>Text Y <input name="textY" type="number" value="120" /></label>
		<button type="submit">Create</button>
	</form>
</section>
<section class="card">
	<table>
		<thead><tr><th>Name</th><th>Type</th><th>Size</th><th>DPI</th></tr></thead>
		<tbody
			>{#each data.templates as template (template.id)}<tr
					><td>{template.name}</td><td>{template.type}</td><td
						>{template.widthMm}×{template.heightMm} mm</td
					><td>{template.dpi}</td></tr
				>{/each}</tbody
		>
	</table>
</section>
