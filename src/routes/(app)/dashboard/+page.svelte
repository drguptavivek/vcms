<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Dashboard | VCMS Barcode</title>
</svelte:head>

<h1>Barcode Printing Dashboard</h1>
<div class="stats">
	<div class="card"><strong>{data.teams.length}</strong><span>Teams</span></div>
	<div class="card"><strong>{data.pecs.length}</strong><span>PECs</span></div>
	<div class="card"><strong>{data.series.length}</strong><span>Active Series</span></div>
	<div class="card"><strong>{data.batches.length}</strong><span>Recent Batches</span></div>
</div>

<section class="card">
	<h2>Recent Batches</h2>
	<table>
		<thead><tr><th>PEC</th><th>Year</th><th>Type</th><th>Qty</th><th>When</th></tr></thead>
		<tbody>
			{#each data.batches as batch (batch.id)}
				<tr>
					<td>{String(batch.pecCode).padStart(2, '0')} {batch.pecName}</td>
					<td>{String(batch.year).padStart(2, '0')}</td>
					<td>{batch.type}</td>
					<td>{batch.quantity}</td>
					<td>{new Date(batch.createdAt).toLocaleString()}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<style>
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 1rem;
	}
	strong {
		display: block;
		font-size: 2rem;
	}
	span {
		color: #64748b;
	}
</style>
