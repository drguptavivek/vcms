<script lang="ts">
	import { resolve } from '$app/paths';

	let { data, children } = $props();
</script>

<div class="shell">
	<aside>
		<h1>VCMS</h1>
		<p>{data.user.email}</p>
		<nav>
			<a href={resolve('/dashboard')}>Dashboard</a>
			<a href={resolve('/barcode')}>Print Barcodes</a>
			<a href={resolve('/barcode/batches')}>Batches</a>
			<a href={resolve('/barcode/sequences')}>Sequences</a>
			<a href={resolve('/barcode/reserve-offline')}>Reserve Offline</a>
			<a href={resolve('/teams')}>Teams</a>
			<a href={resolve('/pecs')}>PECs</a>
			<a href={resolve('/printer-templates')}>Printer Templates</a>
			<a href={resolve('/users')}>Users</a>
		</nav>
	</aside>
	<section class="content">
		{@render children()}
	</section>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
		background: #f8fafc;
		color: #0f172a;
	}
	.shell {
		display: grid;
		grid-template-columns: 16rem 1fr;
		min-height: 100vh;
	}
	aside {
		background: #0f172a;
		color: white;
		padding: 1.2rem;
	}
	aside h1 {
		margin-block: 0 0.25rem;
	}
	aside p {
		color: #cbd5e1;
		font-size: 0.85rem;
		overflow-wrap: anywhere;
	}
	nav {
		display: grid;
		gap: 0.3rem;
		margin-top: 1.5rem;
	}
	nav a {
		color: white;
		text-decoration: none;
		padding: 0.65rem;
		border-radius: 0.5rem;
	}
	nav a:hover {
		background: #1e293b;
	}
	.content {
		padding: 2rem;
	}
	:global(.card) {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 0.85rem;
		padding: 1.25rem;
		margin-bottom: 1rem;
		box-shadow: 0 4px 16px rgb(15 23 42 / 5%);
	}
	:global(form.grid) {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 0.8rem;
		align-items: end;
	}
	:global(label) {
		display: grid;
		gap: 0.3rem;
		font-weight: 600;
	}
	:global(input),
	:global(select),
	:global(button),
	:global(textarea) {
		padding: 0.6rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
		font: inherit;
	}
	:global(button) {
		background: #0f766e;
		color: white;
		border-color: #0f766e;
		font-weight: 700;
		cursor: pointer;
	}
	:global(table) {
		width: 100%;
		border-collapse: collapse;
		background: white;
	}
	:global(th),
	:global(td) {
		padding: 0.65rem;
		border-bottom: 1px solid #e2e8f0;
		text-align: left;
	}
	:global(.muted) {
		color: #64748b;
	}
	:global(.error) {
		color: #b91c1c;
	}
</style>
