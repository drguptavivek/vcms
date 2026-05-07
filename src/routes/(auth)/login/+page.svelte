<script lang="ts">
	let { form } = $props();
</script>

<svelte:head>
	<title>Login | VCMS Barcode</title>
</svelte:head>

<main class="auth-card">
	<h1>VCMS Barcode Login</h1>
	<p>Use the seeded admin account for local development.</p>
	{#if form?.message}
		<p class="error">{form.message}</p>
	{/if}
	<form method="POST">
		<label>
			Email
			<input name="email" type="email" value="admin@example.test" required />
		</label>
		<label>
			Password
			<input name="password" type="password" value="ChangeMe123!" required />
		</label>
		<button type="submit">Sign in</button>
	</form>
</main>

<style>
	.auth-card {
		max-width: 28rem;
		margin: 10vh auto;
		padding: 2rem;
		border: 1px solid #d7dde8;
		border-radius: 1rem;
		box-shadow: 0 10px 30px rgb(15 23 42 / 8%);
	}
	label {
		display: grid;
		gap: 0.35rem;
		margin-block: 1rem;
	}
	input,
	button {
		padding: 0.7rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
	}
	button {
		background: #0f766e;
		color: white;
		font-weight: 700;
		cursor: pointer;
	}
	.error {
		color: #b91c1c;
	}
</style>
