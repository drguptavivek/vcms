<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let { data } = $props();
	let message = $state('');

	async function changeDashboardYear(event: SubmitEvent) {
		event.preventDefault();
		const form = new FormData(event.currentTarget as HTMLFormElement);
		const response = await fetch('/api/v1/settings/barcode-year', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				year: Number(form.get('year')),
				reason: String(form.get('reason'))
			})
		});
		if (response.ok) await goto(resolve('/barcode'));
		else message = (await response.json()).error?.message ?? 'Barcode year change failed.';
	}

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

<h1>Change Barcode Year</h1>
<section class="card">
	<h2>Dashboard Barcode Year</h2>
	<p class="muted">
		This changes the barcode year shown on the printing dashboard for all PEC rows. It does not
		change existing print runs.
	</p>
	<form class="year-form" onsubmit={changeDashboardYear}>
		<label>
			Year YY
			<input
				name="year"
				type="number"
				min={data.yearBounds.min}
				max={data.yearBounds.max}
				value={data.currentYear}
				required
			/>
			<span class="hint">
				Allowed: {String(data.yearBounds.min).padStart(2, '0')} to {String(
					data.yearBounds.max
				).padStart(2, '0')}
			</span>
		</label>
		<label>
			Reason
			<input name="reason" value="Operational barcode year rollover" required />
		</label>
		<div class="form-action">
			<button type="submit">Change Year For All PECs</button>
		</div>
	</form>
</section>

<section class="card">
	<h2>Advanced: Set PEC Next Serial</h2>
	{#if message}<p class="error">{message}</p>{/if}
	<form class="settings-form" onsubmit={reset}>
		<label>
			PEC
			<select name="pecId">
				{#each data.pecs as pec (pec.id)}
					<option value={pec.id}>{String(pec.code).padStart(2, '0')} - {pec.name}</option>
				{/each}
			</select>
		</label>
		<label>
			Year YY
			<input name="year" type="number" min="0" max="99" value={data.currentYear} required />
		</label>
		<label>
			Next Serial
			<input name="nextSerial" type="number" min="1" max="999999" value="1" required />
		</label>
		<label>Reason <input name="reason" value="Manual sequence setup" required /></label>
		<div class="form-action">
			<button type="submit">Set</button>
		</div>
	</form>
</section>
<section class="card">
	<h2>Current Series</h2>
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

<style>
	.year-form {
		display: grid;
		grid-template-columns: minmax(10rem, 14rem) minmax(16rem, 1fr) minmax(16rem, max-content);
		gap: 0.8rem;
		align-items: start;
	}
	.settings-form {
		display: grid;
		grid-template-columns: repeat(5, minmax(10rem, 1fr));
		gap: 0.8rem;
		align-items: start;
	}
	.year-form label,
	.settings-form label {
		grid-template-rows: 1.5rem 2.75rem 1.1rem;
	}
	.year-form input,
	.settings-form input,
	.settings-form select {
		box-sizing: border-box;
		width: 100%;
		height: 2.75rem;
	}
	.form-action {
		padding-top: 1.5rem;
	}
	.form-action button {
		box-sizing: border-box;
		width: 100%;
		height: 2.75rem;
	}
	.hint {
		color: #64748b;
		font-size: 0.85rem;
		font-weight: 500;
	}
	@media (max-width: 760px) {
		.year-form {
			grid-template-columns: 1fr;
		}
		.settings-form {
			grid-template-columns: 1fr;
		}
	}
</style>
