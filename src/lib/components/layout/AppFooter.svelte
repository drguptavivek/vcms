<script lang="ts">
	const currentYear = new Date().getFullYear();
</script>

<footer class="app-footer">
	<p>
		© 2026{#if currentYear > 2026}–{currentYear}{/if} Community Ophthalmology. Dr. R.P. Centre for Ophthalmic
		Sciences, AIIMS, New Delhi.
	</p>
</footer>

<style>
	.app-footer {
		border-top: 1px solid var(--color-border);
		background: var(--color-surface-card);
		padding: 0.9rem 1.25rem;
		color: var(--color-text-muted);
		font-size: 0.85rem;
	}
	.app-footer p {
		margin: 0;
	}
</style>
