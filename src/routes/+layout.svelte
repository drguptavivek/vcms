<script lang="ts">
	import '$lib/styles/fonts.css';
	import '$lib/styles/theme.css';
	import AppFooter from '$lib/components/layout/AppFooter.svelte';
	import AppHeader from '$lib/components/layout/AppHeader.svelte';

	let { children } = $props();
</script>

<div class="page-shell">
	<AppHeader />
	<div class="page-main">
		{@render children()}
	</div>
	<AppFooter />
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: var(--font-sans);
		background: var(--color-surface-page);
		color: var(--color-text);
		font-feature-settings:
			'kern' 1,
			'liga' 1,
			'calt' 1;
	}
	:global(h1),
	:global(h2),
	:global(h3),
	:global(h4) {
		font-family: var(--font-display);
		letter-spacing: -0.015em;
	}
	.page-shell {
		min-height: 100vh;
		display: grid;
		grid-template-rows: auto 1fr auto;
	}
	.page-main {
		min-width: 0;
	}
</style>
