<script lang="ts">
	type IconName = 'home' | 'barcode' | 'history' | 'skip' | 'settings' | 'users' | 'database';

	type Props = {
		name: IconName;
		size?: number;
		label?: string;
	};

	let { name, size = 18, label }: Props = $props();
	const paths: Record<IconName, string> = {
		home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3V10.5Z',
		barcode:
			'M4 5h1.5v14H4V5Zm3 0h3v14H7V5Zm4.5 0H13v14h-1.5V5Zm3 0H18v14h-3.5V5Zm5 0H21v14h-1.5V5Z',
		history:
			'M4 12a8 8 0 1 0 2.34-5.66L4 8.68V3H2v9h9v-2H5.41l2.35-2.24A6 6 0 1 1 6 12H4Zm7-4h2v5l4 2-.9 1.8-5.1-2.55V8Z',
		skip: 'M5 5h2v14H5V5Zm4.5 1.5L17 12l-7.5 5.5v-11ZM18 5h2v14h-2V5Z',
		settings:
			'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8.94 3.06-2.03-.34a7.63 7.63 0 0 0-.64-1.54l1.2-1.68-1.97-1.97-1.68 1.2c-.49-.26-1-.47-1.54-.64l-.34-2.03h-2.88l-.34 2.03c-.54.17-1.05.38-1.54.64l-1.68-1.2L5.53 7.5l1.2 1.68c-.26.49-.47 1-.64 1.54l-2.03.34v2.88l2.03.34c.17.54.38 1.05.64 1.54l-1.2 1.68 1.97 1.97 1.68-1.2c.49.26 1 .47 1.54.64l.34 2.03h2.88l.34-2.03c.54-.17 1.05-.38 1.54-.64l1.68 1.2 1.97-1.97-1.2-1.68c.26-.49.47-1 .64-1.54l2.03-.34v-2.88Z',
		users:
			'M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7-1a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20a6.5 6.5 0 0 1 13 0v1H2v-1Zm12.5-7c3.04 0 5.5 2.46 5.5 5.5V21h-3v-1a8.45 8.45 0 0 0-2.8-6.3c.1-.23.2-.46.3-.7Z',
		database:
			'M12 3C7 3 4 4.8 4 7v10c0 2.2 3 4 8 4s8-1.8 8-4V7c0-2.2-3-4-8-4Zm0 2c4 0 6 1.2 6 2s-2 2-6 2-6-1.2-6-2 2-2 6-2Zm0 14c-4 0-6-1.2-6-2v-1.5c1.4.9 3.5 1.5 6 1.5s4.6-.6 6-1.5V17c0 .8-2 2-6 2Zm0-4c-4 0-6-1.2-6-2v-1.5c1.4.9 3.5 1.5 6 1.5s4.6-.6 6-1.5V13c0 .8-2 2-6 2Z'
	};
</script>

<svg
	class="icon"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	role={label ? 'img' : 'presentation'}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	focusable="false"
>
	<path d={paths[name]} />
</svg>

<style>
	.icon {
		display: inline-block;
		flex: none;
		fill: currentcolor;
		vertical-align: -0.18em;
	}
</style>
