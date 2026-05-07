<script lang="ts">
	let { data } = $props();
	let message = $state('');

	async function reset(event: SubmitEvent) {
		event.preventDefault();
		const form = new FormData(event.currentTarget as HTMLFormElement);
		const response = await fetch('/api/v1/barcode/series/reset', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				pecId: Number(form.get('pecId')),
				year: Number(form.get('year')),
				nextSerial: Number(form.get('nextSerial')),
				reason: String(form.get('reason'))
			})
		});
		if (response.ok) location.reload();
		else message = (await response.json()).error?.message ?? 'Reset failed.';
	}
</script>

<h1>Barcode Sequences</h1>
<section class="card">
	<h2>Set Next Serial</h2>
	{#if message}<p class="error">{message}</p>{/if}
	<form class="grid" onsubmit={reset}>
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
			>Next Serial <input
				name="nextSerial"
				type="number"
				min="1"
				max="999999"
				value="1"
				required
			/></label
		>
		<label>Reason <input name="reason" value="Manual sequence setup" required /></label>
		<button type="submit">Set</button>
	</form>
</section>
<section class="card">
	<table>
		<thead><tr><th>PEC</th><th>Year</th><th>Next Serial</th><th>Locked</th></tr></thead>
		<tbody
			>{#each data.series as row (row.id)}<tr
					><td>{String(row.pecCode).padStart(2, '0')} - {row.pecName}</td><td
						>{String(row.year).padStart(2, '0')}</td
					><td>{String(row.nextSerial).padStart(6, '0')}</td><td>{row.locked ? 'Yes' : 'No'}</td
					></tr
				>{/each}</tbody
		>
	</table>
</section>
