<script lang="ts">
	let { data } = $props();
	let output = $state('');
	let message = $state('');

	async function reprint(batchId: string) {
		const response = await fetch(`/api/v1/barcode/batches/${batchId}/reprint`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ output: 'zpl', reason: 'Print failure reprint' })
		});
		const json = await response.json();
		if (response.ok) {
			output =
				json.data.print.output === 'zpl'
					? json.data.print.content
					: JSON.stringify(json.data, null, 2);
			message = '';
		} else {
			message = json.error?.message ?? 'Reprint failed.';
		}
	}
</script>

<h1>Barcode Batches</h1>
{#if message}<p class="error">{message}</p>{/if}
<section class="card">
	<table>
		<thead
			><tr><th>PEC</th><th>Year</th><th>Type</th><th>Qty</th><th>Created</th><th>Reprint</th></tr
			></thead
		>
		<tbody>
			{#each data.batches as batch (batch.id)}
				<tr>
					<td>{String(batch.pecCode).padStart(2, '0')} - {batch.pecName}</td>
					<td>{String(batch.year).padStart(2, '0')}</td>
					<td>{batch.type}</td>
					<td>{batch.quantity}</td>
					<td>{new Date(batch.createdAt).toLocaleString()}</td>
					<td><button onclick={() => reprint(batch.id)}>Reprint ZPL</button></td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>
{#if output}
	<section class="card">
		<h2>Reprint Output</h2>
		<textarea rows="18" readonly>{output}</textarea>
	</section>
{/if}

<style>
	textarea {
		width: 100%;
		font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
	}
</style>
