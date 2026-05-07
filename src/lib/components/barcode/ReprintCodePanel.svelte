<script lang="ts">
	type ReprintRangeInput = {
		startSerial: number;
		endSerial: number;
		reason: string;
	};

	type ReprintSingleInput = {
		serial: number;
		reason: string;
	};

	type Props = {
		pecCode: number;
		pecName: string;
		year: number;
		defaultStartSerial: number;
		defaultEndSerial: number;
		minSerial?: number;
		maxSerial?: number;
		rangeReason?: string;
		singleReason?: string;
		onRangePrint: (input: ReprintRangeInput) => void | Promise<void>;
		onSinglePrint: (input: ReprintSingleInput) => void | Promise<void>;
		onCancel: () => void;
	};

	let {
		pecCode,
		pecName,
		year,
		defaultStartSerial,
		defaultEndSerial,
		minSerial = 1,
		maxSerial = 999999,
		rangeReason = 'Reprint selected PEC barcode range',
		singleReason = 'Reprint one PEC barcode',
		onRangePrint,
		onSinglePrint,
		onCancel
	}: Props = $props();

	let rangeStart = $state(1);
	let rangeEnd = $state(1);
	let singleSerial = $state(1);

	$effect(() => {
		rangeStart = defaultStartSerial;
		rangeEnd = defaultEndSerial;
		singleSerial = defaultStartSerial;
	});

	function barcodeValue(serial: number) {
		return `${String(pecCode).padStart(2, '0')}-${String(year).padStart(2, '0')}-${String(serial).padStart(6, '0')}`;
	}

	async function printRange(event: SubmitEvent) {
		event.preventDefault();
		const form = new FormData(event.currentTarget as HTMLFormElement);
		await onRangePrint({
			startSerial: rangeStart,
			endSerial: rangeEnd,
			reason: String(form.get('reason') ?? '')
		});
	}

	async function printSingle(event: SubmitEvent) {
		event.preventDefault();
		const form = new FormData(event.currentTarget as HTMLFormElement);
		await onSinglePrint({
			serial: singleSerial,
			reason: String(form.get('reason') ?? '')
		});
	}
</script>

<section class="confirm-panel">
	<h3>Reprint Barcode</h3>
	<p>
		Choose range or single barcode reprint for
		<strong>{String(pecCode).padStart(2, '0')} - {pecName}</strong>.
	</p>
	<p class="muted">
		The system validates requested serials against earlier printed barcodes for this PEC/year. No
		new barcode numbers are allocated.
	</p>
	<div class="reprint-panels">
		<form class="reprint-card" onsubmit={printRange}>
			<h4>Range</h4>
			<p class="muted">Use this to reprint multiple consecutive barcode stickers.</p>
			<label
				>Start Serial
				<input
					name="startSerial"
					type="number"
					min={minSerial}
					max={maxSerial}
					bind:value={rangeStart}
					required
				/></label
			>
			<label
				>End Serial
				<input
					name="endSerial"
					type="number"
					min={minSerial}
					max={maxSerial}
					bind:value={rangeEnd}
					required
				/></label
			>
			<p class="range-preview">
				{barcodeValue(rangeStart)}
				<span>to</span>
				{barcodeValue(rangeEnd)}
			</p>
			<label>Reason <input name="reason" value={rangeReason} required /></label>
			<button type="submit">Print Range</button>
		</form>
		<form class="reprint-card" onsubmit={printSingle}>
			<h4>Single</h4>
			<p class="muted">Use this when only one barcode sticker needs to be reprinted.</p>
			<label
				>Serial
				<input
					name="serial"
					type="number"
					min={minSerial}
					max={maxSerial}
					bind:value={singleSerial}
					required
				/></label
			>
			<p class="range-preview">{barcodeValue(singleSerial)}</p>
			<label>Reason <input name="reason" value={singleReason} required /></label>
			<button type="submit">Print Single</button>
		</form>
	</div>
	<div class="button-row panel-actions">
		<button type="button" class="secondary" onclick={onCancel}>Cancel</button>
	</div>
</section>

<style>
	.confirm-panel {
		border: 1px solid #99f6e4;
		border-radius: 0.75rem;
		background: #f0fdfa;
		padding: 1rem;
	}
	.confirm-panel h3 {
		margin-top: 0;
	}
	.reprint-panels {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 1rem;
	}
	.reprint-card {
		display: grid;
		gap: 0.75rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.75rem;
		background: white;
		padding: 1rem;
	}
	.reprint-card h4 {
		margin: 0;
	}
	.range-preview {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		align-items: center;
		font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
		font-size: 1.05rem;
		font-weight: 800;
	}
	.range-preview span {
		color: #64748b;
		font-family: inherit;
		font-weight: 600;
	}
	.button-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.panel-actions {
		margin-top: 1rem;
	}
	.secondary {
		background: #f8fafc;
		color: #0f172a;
		border-color: #cbd5e1;
	}
</style>
