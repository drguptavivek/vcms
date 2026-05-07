<script lang="ts">
	let { data } = $props();
	let message = $state('');

	async function reserve(event: SubmitEvent) {
		event.preventDefault();
		const form = new FormData(event.currentTarget as HTMLFormElement);
		const response = await fetch('/api/v1/barcode/ranges/reserve-offline', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				pecId: Number(form.get('pecId')),
				year: Number(form.get('year')),
				startSerial: Number(form.get('startSerial')),
				endSerial: Number(form.get('endSerial')),
				reason: String(form.get('reason'))
			})
		});
		if (response.ok) message = 'Offline range reserved.';
		else message = (await response.json()).error?.message ?? 'Reserve failed.';
	}
</script>

<h1>Reserve Offline Barcodes</h1>
<section class="card">
	<p class="muted">
		Use this when barcode numbers were issued offline and must be skipped by future print batches.
	</p>
	{#if message}<p>{message}</p>{/if}
	<form class="grid" onsubmit={reserve}>
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
			>Start Serial <input name="startSerial" type="number" min="1" max="999999" required /></label
		>
		<label>End Serial <input name="endSerial" type="number" min="1" max="999999" required /></label>
		<label>Reason <input name="reason" value="Offline issued barcodes" required /></label>
		<button type="submit">Reserve</button>
	</form>
</section>
