<script lang="ts">
	import EmrBuilderEditor from '$lib/components/emr-builder/EmrBuilderEditor.svelte';

	let { data } = $props();

	const initialPayload = $derived.by(() => data.draftPayload ?? data.fixtureDefinition);
</script>

<EmrBuilderEditor
	initialDefinitionId={data.definitionId}
	initialDefinitionRecord={data.definitionRecord}
	initialDraftPayload={initialPayload}
	initialMessage={data.message}
/>
