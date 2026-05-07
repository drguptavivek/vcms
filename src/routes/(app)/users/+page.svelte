<script lang="ts">
	let { data } = $props();
	let message = $state('');

	async function postJson(url: string, body: unknown) {
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (response.ok) location.reload();
		else message = (await response.json()).error?.message ?? 'Request failed.';
	}
</script>

<h1>User Management</h1>
{#if message}<p class="error">{message}</p>{/if}
<section class="card">
	<h2>Assign Role</h2>
	<form
		class="grid"
		onsubmit={(event) => {
			event.preventDefault();
			const form = new FormData(event.currentTarget as HTMLFormElement);
			postJson('/api/v1/users/roles', {
				userId: form.get('userId'),
				roleName: form.get('roleName')
			});
		}}
	>
		<label
			>User <select name="userId"
				>{#each data.users as user (user.id)}<option value={user.id}>{user.email}</option
					>{/each}</select
			></label
		>
		<label
			>Role <select name="roleName"
				><option value="admin">admin</option><option value="barcode_print_manager"
					>barcode_print_manager</option
				></select
			></label
		>
		<button type="submit">Assign</button>
	</form>
</section>
<section class="card">
	<h2>Allocate PEC</h2>
	<form
		class="grid"
		onsubmit={(event) => {
			event.preventDefault();
			const form = new FormData(event.currentTarget as HTMLFormElement);
			postJson('/api/v1/users/pec-allocations', {
				userId: form.get('userId'),
				pecId: Number(form.get('pecId'))
			});
		}}
	>
		<label
			>User <select name="userId"
				>{#each data.users as user (user.id)}<option value={user.id}>{user.email}</option
					>{/each}</select
			></label
		>
		<label
			>PEC <select name="pecId"
				>{#each data.pecs as pec (pec.id)}<option value={pec.id}
						>{String(pec.code).padStart(2, '0')} - {pec.name}</option
					>{/each}</select
			></label
		>
		<button type="submit">Allocate</button>
	</form>
</section>
<section class="card">
	<h2>Users</h2>
	<table>
		<thead><tr><th>Name</th><th>Email</th></tr></thead><tbody
			>{#each data.users as user (user.id)}<tr><td>{user.name}</td><td>{user.email}</td></tr
				>{/each}</tbody
		>
	</table>
</section>
