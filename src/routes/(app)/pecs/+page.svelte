<script lang="ts">
	let { data } = $props();
	let message = $state('');

	async function createPec(event: SubmitEvent) {
		event.preventDefault();
		const form = new FormData(event.currentTarget as HTMLFormElement);
		const response = await fetch('/api/v1/pecs', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				code: Number(form.get('code')),
				name: String(form.get('name')),
				teamId: Number(form.get('teamId'))
			})
		});
		if (response.ok) location.reload();
		else message = (await response.json()).error?.message ?? 'Failed to create PEC.';
	}
</script>

<h1>PEC Master</h1>
<section class="card">
	<h2>Create PEC</h2>
	{#if message}<p class="error">{message}</p>{/if}
	<form class="grid" onsubmit={createPec}>
		<label>PEC Code <input name="code" type="number" min="0" max="99" required /></label>
		<label>Name <input name="name" required /></label>
		<label
			>Team
			<select name="teamId" required
				>{#each data.teams as team (team.id)}<option value={team.id}
						>{team.code} - {team.name}</option
					>{/each}</select
			>
		</label>
		<button type="submit">Create</button>
	</form>
</section>
<section class="card">
	<table>
		<thead><tr><th>Code</th><th>Name</th><th>Team</th><th>Active</th></tr></thead>
		<tbody>
			{#each data.pecs as pec (pec.id)}
				<tr
					><td>{String(pec.code).padStart(2, '0')}</td><td>{pec.name}</td><td>{pec.teamName}</td><td
						>{pec.active ? 'Yes' : 'No'}</td
					></tr
				>
			{/each}
		</tbody>
	</table>
</section>
