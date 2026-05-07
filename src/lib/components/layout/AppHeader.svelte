<script lang="ts">
	import { resolve } from '$app/paths';
	import logo from '$lib/assets/logo.svg';
</script>

<header class="app-header">
	<a class="brand" href={resolve('/dashboard')} aria-label="Vision Center Management System home">
		<img class="logo" src={logo} alt="" aria-hidden="true" />
		<span>
			<strong>Community Ophthalmology, RPC</strong>
			<small>Vision Center Management System</small>
		</span>
	</a>
</header>

<style>
	.app-header {
		position: sticky;
		top: 0;
		z-index: 5;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface-card);
		padding: 0.85rem 1.25rem;
	}
	.brand {
		display: inline-flex;
		gap: 0.8rem;
		align-items: center;
		color: var(--color-text);
		text-decoration: none;
	}
	.logo {
		width: 2.6rem;
		height: 2.6rem;
		display: block;
	}
	strong,
	small {
		display: block;
	}
	strong {
		font-family: var(--font-display);
		font-size: 1.05rem;
	}
	small {
		color: var(--color-text-muted);
		font-size: 0.85rem;
	}
</style>
