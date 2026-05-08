<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from '$lib/components/ui/Icon.svelte';

	let { data, children } = $props();
	let navCollapsed = $state(false);

	const barcodeLinks = [
		{ path: '/barcode', label: 'Barcode Printing Dashboard', icon: 'barcode' },
		{ path: '/barcode/batches', label: 'Print Runs', icon: 'history' },
		{ path: '/printer-templates', label: 'Printer Templates', icon: 'settings' }
	] as const;

	const adminBarcodeLinks = [
		...barcodeLinks,
		{ path: '/barcode/sequences', label: 'Change Years', icon: 'database' }
	] as const;

	const adminLinks = [
		{ path: '/teams', label: 'Teams', icon: 'users' },
		{ path: '/pecs', label: 'PECs', icon: 'database' },
		{ path: '/users', label: 'Users', icon: 'users' },
		{ path: '/qz-integration', label: 'QZ Integration', icon: 'settings' }
	] as const;

	const emrBuilderLinks = [
		{ path: '/emr-builder', label: 'Forms', icon: 'forms' },
		{ path: '/emr-builder/pec-opd-register/edit', label: 'OPD Register', icon: 'edit' },
		{
			path: '/emr-builder/reported-patients-record/edit',
			label: 'Reported Patients',
			icon: 'edit'
		},
		{ path: '/emr-builder/cataract-surgery-record/edit', label: 'Cataract Surgery', icon: 'edit' },
		{
			path: '/emr-builder/cataract-followup-record/edit',
			label: 'Cataract Follow-up',
			icon: 'edit'
		}
	] as const;

	const overviewLinks = [{ path: '/dashboard', label: 'Dashboard', icon: 'home' }] as const;

	const pathname = $derived(page.url.pathname);
	const section = $derived(
		pathname.startsWith('/barcode') || pathname.startsWith('/printer-templates')
			? 'barcodes'
			: pathname.startsWith('/emr-builder')
				? 'emr-builder'
				: pathname.startsWith('/teams') ||
					  pathname.startsWith('/pecs') ||
					  pathname.startsWith('/users') ||
					  pathname.startsWith('/qz-integration')
					? 'admin'
					: 'overview'
	);
	const sectionTitle = $derived(
		section === 'barcodes'
			? 'Barcodes'
			: section === 'emr-builder'
				? 'EMR Builder'
				: section === 'admin'
					? 'Admin'
					: 'Overview'
	);
	const sectionLinks = $derived(
		section === 'barcodes'
			? data.isAdmin
				? adminBarcodeLinks
				: barcodeLinks
			: section === 'emr-builder'
				? emrBuilderLinks
				: section === 'admin'
					? adminLinks
					: overviewLinks
	);

	function isActive(path: string) {
		return pathname === path || (path !== '/dashboard' && pathname.startsWith(`${path}/`));
	}
</script>

<nav class="section-nav" aria-label="Major system sections">
	<a href={resolve('/dashboard')} class:active={section === 'overview'}>
		<Icon name="home" />
		<span>Overview</span>
	</a>
	<a href={resolve('/barcode')} class:active={section === 'barcodes'}>
		<Icon name="barcode" />
		<span>Barcodes</span>
	</a>
	<a href={resolve('/emr-builder')} class:active={section === 'emr-builder'}>
		<Icon name="forms" />
		<span>EMR Builder</span>
	</a>
	<a href={resolve('/teams')} class:active={section === 'admin'}>
		<Icon name="settings" />
		<span>Admin</span>
	</a>
</nav>

<div class:collapsed={navCollapsed} class="shell">
	<aside aria-label={`${sectionTitle} navigation`}>
		<div class="side-head">
			<div>
				<h1>{sectionTitle}</h1>
				<p>{data.user.email}</p>
			</div>
			<button
				type="button"
				class="collapse-button"
				aria-label={navCollapsed ? 'Expand left navigation' : 'Collapse left navigation'}
				aria-pressed={navCollapsed}
				onclick={() => (navCollapsed = !navCollapsed)}
			>
				<span aria-hidden="true">{navCollapsed ? '›' : '‹'}</span>
			</button>
		</div>
		<nav class="side-nav" aria-label={`${sectionTitle} links`}>
			{#each sectionLinks as link (link.path)}
				<a
					href={resolve(link.path)}
					class:active={isActive(link.path)}
					title={navCollapsed ? link.label : undefined}
				>
					<Icon name={link.icon} />
					<span>{link.label}</span>
				</a>
			{/each}
		</nav>
	</aside>
	<section class="content">
		{@render children()}
	</section>
</div>

<style>
	.shell {
		display: grid;
		grid-template-columns: 16rem 1fr;
		min-height: 100%;
		transition: grid-template-columns 0.18s ease;
	}
	.shell.collapsed {
		grid-template-columns: 4.7rem 1fr;
	}
	.section-nav {
		position: sticky;
		top: 4.35rem;
		z-index: 4;
		display: flex;
		gap: 0.5rem;
		align-items: center;
		padding: 0.7rem 1.25rem;
		border-bottom: 1px solid var(--color-border);
		background:
			linear-gradient(90deg, rgb(255 255 255 / 92%), rgb(244 251 249 / 92%)),
			var(--color-surface-card);
		backdrop-filter: blur(14px);
	}
	.section-nav a {
		display: inline-flex;
		gap: 0.5rem;
		align-items: center;
		color: var(--color-text-muted);
		text-decoration: none;
		font-weight: 800;
		padding: 0.55rem 0.8rem;
		border: 1px solid transparent;
		border-radius: 999px;
	}
	.section-nav a:hover,
	.section-nav a.active {
		color: var(--color-rpc-navy);
		background: var(--color-rpc-mint);
		border-color: var(--color-border);
	}
	aside {
		background: var(--color-rpc-navy);
		color: var(--color-surface-card);
		padding: 1rem 0.8rem;
	}
	.side-head {
		display: flex;
		gap: 0.7rem;
		align-items: flex-start;
		justify-content: space-between;
	}
	aside h1 {
		margin-block: 0 0.25rem;
		font-size: 1.15rem;
	}
	aside p {
		color: var(--color-border);
		font-size: 0.85rem;
		overflow-wrap: anywhere;
	}
	.collapse-button {
		display: inline-grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		padding: 0;
		border-color: rgb(255 255 255 / 18%);
		border-radius: 999px;
		background: rgb(255 255 255 / 10%);
		color: var(--color-surface-card);
	}
	.side-nav {
		display: grid;
		gap: 0.3rem;
		margin-top: 1.5rem;
	}
	.side-nav a {
		display: grid;
		grid-template-columns: 1.35rem 1fr;
		gap: 0.65rem;
		align-items: center;
		color: var(--color-surface-card);
		text-decoration: none;
		padding: 0.65rem;
		border-radius: 0.5rem;
	}
	.side-nav a:hover,
	.side-nav a.active {
		background: var(--color-rpc-navy-hover);
	}
	.shell.collapsed aside {
		padding-inline: 0.6rem;
	}
	.shell.collapsed .side-head {
		justify-content: center;
	}
	.shell.collapsed .side-head > div,
	.shell.collapsed .side-nav a span {
		display: none;
	}
	.shell.collapsed .side-nav a {
		grid-template-columns: 1fr;
		justify-items: center;
		padding-inline: 0.5rem;
	}
	.content {
		padding: 2rem;
	}
	:global(.card) {
		background: var(--color-surface-card);
		border: 1px solid var(--color-border);
		border-radius: 0.85rem;
		padding: 1.25rem;
		margin-bottom: 1rem;
		box-shadow: var(--shadow-card);
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
		border: 1px solid var(--color-border-strong);
		border-radius: 0.5rem;
		font: inherit;
	}
	:global(button) {
		background: var(--color-rpc-teal);
		color: var(--color-surface-card);
		border-color: var(--color-rpc-teal);
		font-weight: 700;
		cursor: pointer;
	}
	:global(table) {
		width: 100%;
		border-collapse: collapse;
		background: var(--color-surface-card);
	}
	:global(th),
	:global(td) {
		padding: 0.65rem;
		border-bottom: 1px solid var(--color-border);
		text-align: left;
	}
	:global(.muted) {
		color: var(--color-text-muted);
	}
	:global(.error) {
		color: var(--color-danger);
	}
	@media (max-width: 900px) {
		.shell,
		.shell.collapsed {
			grid-template-columns: 1fr;
		}
		aside {
			position: static;
		}
		.side-head {
			display: none;
		}
		.side-nav {
			display: flex;
			margin-top: 0;
			overflow-x: auto;
		}
		.side-nav a {
			display: inline-flex;
			white-space: nowrap;
		}
		.shell.collapsed .side-nav a span {
			display: inline;
		}
		.content {
			padding: 1rem;
		}
	}
</style>
