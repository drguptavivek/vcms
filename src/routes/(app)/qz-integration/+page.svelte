<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const certificateReady = $derived(
		data.status.certificate.configured && data.status.certificate.readable
	);
	const privateKeyReady = $derived(
		data.status.privateKey.configured && data.status.privateKey.readable
	);
	const ready = $derived(certificateReady && privateKeyReady);
	const rootCaExportHref = resolve('/api/v1/qz/root-ca-certificate.pem');
	const qzTrayReleaseHref = 'https://github.com/drguptavivek/tray/releases';
	let message = $state('');
	let copied = $state('');
	let manualOpen = $state(false);
	let saving = $state(false);
	let generating = $state(false);
	let trayTrust = $state<{
		status: 'checking' | 'ok' | 'missing' | 'unreachable' | 'unconfigured';
		message: string;
		endpoint?: string;
		matchedFingerprint?: string;
	}>({
		status: 'checking',
		message: 'Checking local QZ Tray trusted roots...'
	});

	onMount(() => {
		void checkQzTrayTrust();
	});

	function statusText(configured: boolean, readable: boolean) {
		if (!configured) return 'Not configured';
		return readable ? 'Ready' : 'Needs attention';
	}

	async function copyPem(label: string, value: string) {
		if (!value) return;
		await navigator.clipboard.writeText(value);
		copied = label;
		window.setTimeout(() => {
			if (copied === label) copied = '';
		}, 1800);
	}

	async function checkQzTrayTrust() {
		const expected = normalizeFingerprint(data.credentials.rootCaFingerprint);
		if (!expected) {
			trayTrust = {
				status: 'unconfigured',
				message: 'Generate VCMS credentials before checking QZ Tray trust.'
			};
			return;
		}

		trayTrust = { status: 'checking', message: 'Checking local QZ Tray trusted roots...' };
		const endpoints = [
			'https://localhost.qz.io:8181/trusted-root-cas.json',
			'https://localhost.qz.io:8181/trusted-root-cas',
			'http://localhost:8182/trusted-root-cas.json',
			'http://localhost:8182/trusted-root-cas'
		];

		for (const endpoint of endpoints) {
			try {
				const response = await fetch(endpoint, { cache: 'no-store' });
				if (!response.ok) continue;
				const body = (await response.json()) as {
					activeRootCAs?: Array<{ fingerprint?: string }>;
					importedRootCAs?: Array<{ fingerprint?: string }>;
				};
				const fingerprints = [...(body.activeRootCAs ?? []), ...(body.importedRootCAs ?? [])]
					.map((certificate) => normalizeFingerprint(certificate.fingerprint))
					.filter(Boolean);
				const match = fingerprints.find((fingerprint) => fingerprint === expected);
				if (match) {
					trayTrust = {
						status: 'ok',
						message: 'Integration OK: QZ Tray trusts the VCMS Root CA.',
						endpoint,
						matchedFingerprint: match
					};
				} else {
					trayTrust = {
						status: 'missing',
						message: 'VCMS Root CA missing. QZ Tray requires Root CA import.',
						endpoint
					};
				}
				return;
			} catch {
				// Try the next QZ local endpoint.
			}
		}

		trayTrust = {
			status: 'unreachable',
			message:
				'QZ Tray is not reachable. Start QZ Tray, or install the expected VCMS QZ Tray build/version.'
		};
	}

	function normalizeFingerprint(fingerprint: string | undefined) {
		return (fingerprint ?? '').replace(/[^a-fA-F0-9]/g, '').toLowerCase();
	}

	async function saveCredentials(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		message = '';
		const form = new FormData(event.currentTarget as HTMLFormElement);
		const response = await fetch('/api/v1/qz/credentials', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				rootCaCertificatePem: form.get('rootCaCertificatePem'),
				rootCaPrivateKeyPem: form.get('rootCaPrivateKeyPem'),
				certificatePem: form.get('certificatePem'),
				privateKeyPem: form.get('privateKeyPem'),
				privateKeyPassphrase: form.get('privateKeyPassphrase'),
				reason: form.get('reason')
			})
		});
		saving = false;
		if (response.ok) location.reload();
		else message = (await response.json()).error?.message ?? 'Failed to save QZ credentials.';
	}

	async function generateCredentials() {
		generating = true;
		message = '';
		const response = await fetch('/api/v1/qz/credentials/generate', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ reason: 'Generate QZ Tray signing credentials' })
		});
		generating = false;
		if (response.ok) location.reload();
		else message = (await response.json()).error?.message ?? 'Failed to generate QZ credentials.';
	}
</script>

<h1>QZ Integration</h1>

<section class="card status-panel" class:ready class:trust-ok={trayTrust.status === 'ok'}>
	<div>
		<h2>Direct Print Signing</h2>
		<p class="muted">
			VCMS signs QZ Tray requests on the server and keeps private keys out of browser code.
		</p>
		<p
			class="trust-message"
			class:ok={trayTrust.status === 'ok'}
			class:error={trayTrust.status === 'missing'}
		>
			{trayTrust.message}
		</p>
		{#if trayTrust.endpoint}
			<p class="muted">Checked {trayTrust.endpoint}</p>
		{:else if trayTrust.status === 'unreachable'}
			<p class="muted">Start the QZ Tray app so the local JSON endpoint is reachable.</p>
			<p class="muted">
				The GitHub release qz-tray.jar is an executable fat JAR. Keep it at a safe path and run it
				with java -jar qz-tray.jar.
			</p>
			<p>
				<a href={qzTrayReleaseHref} target="_blank" rel="noreferrer">
					Install QZ Tray from VCMS fork releases
				</a>
			</p>
		{/if}
	</div>
	<div class="status-actions">
		<strong>{ready ? 'Ready' : 'Incomplete'}</strong>
		<button type="button" class="secondary" onclick={checkQzTrayTrust}>Check QZ Tray</button>
	</div>
</section>

<section class="guidance-grid">
	<article class="card">
		<h2>Why QZ Needs This</h2>
		<p>
			VCMS signs print requests with the stored private key. QZ Tray accepts those requests only
			when the browser-provided digital certificate chains to a root CA that QZ Tray trusts.
		</p>
		<p>
			The root CA certificate is public trust material. The root CA key and signing private key stay
			in VCMS encrypted storage.
		</p>
	</article>
	<article class="card">
		<h2>Key Steps</h2>
		<ol>
			<li>Generate the VCMS root CA, digital certificate, and signing key.</li>
			<li>Download or copy the Root CA PEM and add that root CA to QZ Tray.</li>
			<li>Start QZ Tray and import the root CA from Advanced -> Import trusted root CA...</li>
			<li>
				Print from VCMS; the browser receives the digital certificate and VCMS signs messages.
			</li>
		</ol>
	</article>
</section>

<section class="card">
	<h2>Credential Actions</h2>
	{#if message}<p class="error">{message}</p>{/if}
	<div class="button-row">
		<button type="button" onclick={generateCredentials} disabled={generating}>
			{generating ? 'Generating...' : 'Autogenerate and save'}
		</button>
		<a class="button secondary" href={rootCaExportHref} download>Export Root CA PEM</a>
		<button type="button" class="secondary" onclick={() => (manualOpen = !manualOpen)}>
			{manualOpen ? 'Close manual credentials' : 'Manually create certs'}
		</button>
	</div>
	{#if manualOpen}
		<form class="credential-form" onsubmit={saveCredentials}>
			<label>
				Root CA Certificate
				<textarea name="rootCaCertificatePem" rows="4"></textarea>
			</label>
			<label>
				Root CA Private Key
				<textarea name="rootCaPrivateKeyPem" rows="4"></textarea>
			</label>
			<label>
				Digital Certificate
				<textarea name="certificatePem" rows="5" required></textarea>
			</label>
			<label>
				Private Key
				<textarea name="privateKeyPem" rows="5" required></textarea>
			</label>
			<label>
				Private Key Passphrase
				<input name="privateKeyPassphrase" type="password" autocomplete="off" />
			</label>
			<label>
				Reason
				<input name="reason" value="Update QZ Tray signing credentials" required />
			</label>
			<button type="submit" disabled={saving}
				>{saving ? 'Saving...' : 'Save encrypted credentials'}</button
			>
		</form>
	{/if}
</section>

<section class="status-grid">
	<article class="card">
		<h2>Root CA Certificate</h2>
		<p
			class:ok={data.status.rootCaCertificate.readable}
			class:error={!data.status.rootCaCertificate.readable}
		>
			{statusText(data.status.rootCaCertificate.configured, data.status.rootCaCertificate.readable)}
		</p>
		<dl>
			<div>
				<dt>Source</dt>
				<dd>{data.status.rootCaCertificate.source}</dd>
			</div>
			{#if data.status.rootCaCertificate.keyId}
				<div>
					<dt>Key ID</dt>
					<dd>{data.status.rootCaCertificate.keyId}</dd>
				</div>
			{/if}
			{#if data.status.rootCaCertificate.error}
				<div>
					<dt>Issue</dt>
					<dd>{data.status.rootCaCertificate.error}</dd>
				</div>
			{/if}
		</dl>
	</article>

	<article class="card">
		<h2>Certificate</h2>
		<p class:ok={certificateReady} class:error={!certificateReady}>
			{statusText(data.status.certificate.configured, data.status.certificate.readable)}
		</p>
		<dl>
			<div>
				<dt>Source</dt>
				<dd>{data.status.certificate.source}</dd>
			</div>
			{#if data.status.certificate.keyId}
				<div>
					<dt>Key ID</dt>
					<dd>{data.status.certificate.keyId}</dd>
				</div>
			{/if}
			{#if data.status.certificate.error}
				<div>
					<dt>Issue</dt>
					<dd>{data.status.certificate.error}</dd>
				</div>
			{/if}
		</dl>
	</article>

	<article class="card">
		<h2>Private Key</h2>
		<p class:ok={privateKeyReady} class:error={!privateKeyReady}>
			{statusText(data.status.privateKey.configured, data.status.privateKey.readable)}
		</p>
		<dl>
			<div>
				<dt>Source</dt>
				<dd>{data.status.privateKey.source}</dd>
			</div>
			{#if data.status.privateKey.keyId}
				<div>
					<dt>Key ID</dt>
					<dd>{data.status.privateKey.keyId}</dd>
				</div>
			{/if}
			<div>
				<dt>Passphrase</dt>
				<dd>{data.status.privateKeyPassphraseConfigured ? 'configured' : 'not configured'}</dd>
			</div>
			{#if data.status.privateKey.error}
				<div>
					<dt>Issue</dt>
					<dd>{data.status.privateKey.error}</dd>
				</div>
			{/if}
		</dl>
	</article>
</section>

<section class="card">
	<h2>Public Certificates</h2>
	<div class="certificate-actions">
		<article>
			<div>
				<h3>Root CA Certificate</h3>
				<p class="muted">Download or paste this PEM into QZ Tray trust.</p>
			</div>
			<div class="button-row compact">
				<button
					type="button"
					class="secondary"
					disabled={!data.credentials.rootCaCertificatePem}
					onclick={() => copyPem('Root CA Certificate', data.credentials.rootCaCertificatePem)}
				>
					{copied === 'Root CA Certificate' ? 'Copied' : 'Copy PEM'}
				</button>
				<a class="button secondary" href={rootCaExportHref} download>Download PEM</a>
			</div>
		</article>
		<article>
			<div>
				<h3>Digital Certificate</h3>
				<p class="muted">
					Served to browser clients only. Do not add this to QZ Tray's trusted root store.
				</p>
			</div>
			<button
				type="button"
				class="secondary"
				disabled={!data.credentials.certificatePem}
				onclick={() => copyPem('Digital Certificate', data.credentials.certificatePem)}
			>
				{copied === 'Digital Certificate' ? 'Copied' : 'Copy PEM'}
			</button>
		</article>
	</div>
</section>

<section class="card">
	<h2>QZ Tray Trust Import</h2>
	<dl>
		<div>
			<dt>Custom build source</dt>
			<dd>vendor/qz-tray/src/qz/auth/Certificate.java</dd>
		</div>
		<div>
			<dt>Trusted root directory</dt>
			<dd>~/.qz/trusted-root-certs/</dd>
		</div>
		<div>
			<dt>Accepted file types</dt>
			<dd>.crt, .pem, .cer</dd>
		</div>
		<div>
			<dt>Tray menu</dt>
			<dd>Advanced -> Import trusted root CA...</dd>
		</div>
		<div>
			<dt>Expected build</dt>
			<dd>
				Download qz-tray.jar from the VCMS QZ Tray fork release at
				<a href={qzTrayReleaseHref} target="_blank" rel="noreferrer">github.com/drguptavivek/tray</a
				>.
			</dd>
		</div>
		<div>
			<dt>Release JAR</dt>
			<dd>
				qz-tray.jar is an executable fat JAR with bundled QZ Tray classes and dependencies. It does
				not need sibling lib/ files from the repository.
			</dd>
		</div>
		<div>
			<dt>Run command</dt>
			<dd>java -jar qz-tray.jar</dd>
		</div>
		<div>
			<dt>Local requirements</dt>
			<dd>
				A Java runtime must be installed. QZ Tray creates and uses normal runtime data under ~/.qz/
				and still needs browser/system trust for its local HTTPS/WSS certificate.
			</dd>
		</div>
		<div>
			<dt>Import behavior</dt>
			<dd>
				QZ Tray writes the imported root CA as &lt;fingerprint&gt;.crt, dedupes matching
				certificates, and immediately reloads trusted roots.
			</dd>
		</div>
		<div>
			<dt>Diagnostic JSON</dt>
			<dd>
				VCMS compares the expected Root CA fingerprint against QZ Tray's activeRootCAs from
				/trusted-root-cas.json.
			</dd>
		</div>
		<div>
			<dt>Do not import</dt>
			<dd>
				Do not add the Digital Certificate to QZ Tray's trusted root store. QZ Tray must trust the
				Root CA Certificate that issued it.
			</dd>
		</div>
	</dl>
</section>

<section class="card">
	<h2>Runtime Endpoints</h2>
	<table>
		<thead>
			<tr>
				<th>Purpose</th>
				<th>Endpoint</th>
				<th>Access</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td>Certificate</td>
				<td>{data.status.certificateEndpoint}</td>
				<td>public</td>
			</tr>
			<tr>
				<td>Message signing</td>
				<td>{data.status.signingEndpoint}</td>
				<td>admin, barcode_print_manager</td>
			</tr>
			<tr>
				<td>Credential save</td>
				<td>/api/v1/qz/credentials</td>
				<td>admin</td>
			</tr>
			<tr>
				<td>Credential generation</td>
				<td>/api/v1/qz/credentials/generate</td>
				<td>admin</td>
			</tr>
			<tr>
				<td>Algorithm</td>
				<td>{data.status.signingAlgorithm}/RSA</td>
				<td>server-side only</td>
			</tr>
		</tbody>
	</table>
</section>

<section class="card">
	<h2>Fork Packaging</h2>
	<dl>
		<div>
			<dt>Submodule</dt>
			<dd>vendor/qz-tray</dd>
		</div>
		<div>
			<dt>Fork remote</dt>
			<dd>https://github.com/drguptavivek/tray.git</dd>
		</div>
		<div>
			<dt>Trust policy</dt>
			<dd>authcert.override plus tray.strictmode=true</dd>
		</div>
		<div>
			<dt>Credential storage</dt>
			<dd>encrypted database records using AES-256-GCM and an external server master key</dd>
		</div>
	</dl>
</section>

<style>
	.status-panel {
		display: flex;
		gap: 1rem;
		align-items: center;
		justify-content: space-between;
		border-left: 0.35rem solid var(--color-danger);
	}
	.status-panel.ready {
		border-left-color: var(--color-rpc-teal);
	}
	.status-panel.trust-ok {
		border-left-color: var(--color-rpc-teal);
	}
	.status-panel strong {
		padding: 0.4rem 0.7rem;
		border-radius: 0.5rem;
		background: var(--color-rpc-mint);
		color: var(--color-rpc-navy);
	}
	.status-actions {
		display: grid;
		gap: 0.75rem;
		justify-items: end;
	}
	.trust-message {
		margin: 0.75rem 0 0;
		font-weight: 800;
	}
	.status-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: 1rem;
	}
	.guidance-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
		gap: 1rem;
	}
	.guidance-grid p,
	.guidance-grid ol {
		margin: 0.75rem 0 0;
	}
	.guidance-grid li + li {
		margin-top: 0.35rem;
	}
	.credential-form {
		display: grid;
		gap: 1rem;
	}
	.button-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		margin-bottom: 1rem;
	}
	.button-row a {
		display: inline-flex;
		align-items: center;
		padding: 0.6rem;
		border: 1px solid var(--color-rpc-teal);
		border-radius: 0.5rem;
		background: var(--color-surface-card);
		color: var(--color-rpc-teal);
		font-weight: 700;
		text-decoration: none;
	}
	.button-row.compact {
		margin-bottom: 0;
	}
	.credential-form button {
		justify-self: start;
	}
	.certificate-actions {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: 1rem;
	}
	.certificate-actions article {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		justify-content: space-between;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
	}
	.certificate-actions h3 {
		margin: 0;
		font-size: 1rem;
	}
	.certificate-actions p {
		margin: 0.25rem 0 0;
	}
	dl {
		display: grid;
		gap: 0.75rem;
		margin: 1rem 0 0;
	}
	dl div {
		display: grid;
		gap: 0.2rem;
	}
	dt {
		color: var(--color-text-muted);
		font-size: 0.85rem;
		font-weight: 800;
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.ok {
		color: var(--color-rpc-teal);
		font-weight: 800;
	}
</style>
