<script lang="ts">
	let { data } = $props();
	let message = $state('');

	async function createTeam(event: SubmitEvent) {
		event.preventDefault();
		const form = new FormData(event.currentTarget as HTMLFormElement);
		const response = await fetch('/api/v1/teams', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ code: Number(form.get('code')), name: String(form.get('name')) })
		});
		if (response.ok) location.reload();
		else message = (await response.json()).error?.message ?? 'Failed to create team.';
	}
</script>

<h1>Teams</h1>
<section class="card">
	<h2>Create Team</h2>
	{#if message}<p class="error">{message}</p>{/if}
	<form class="grid" onsubmit={createTeam}>
		<label>Code <input name="code" type="number" required /></label>
		<label>Name <input name="name" required /></label>
		<button type="submit">Create</button>
	</form>
</section>
<section class="card">
	<table>
		<thead><tr><th>Code</th><th>Name</th><th>Active</th></tr></thead>
		<tbody
			>{#each data.teams as team (team.id)}<tr
					><td>{team.code}</td><td>{team.name}</td><td>{team.active ? 'Yes' : 'No'}</td></tr
				>{/each}</tbody
		>
	</table>
</section>
