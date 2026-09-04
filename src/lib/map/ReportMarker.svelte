<script lang="ts">
	import { Marker } from 'svelte-maplibre';
	import { CalendarCheck, MapPin, Waves } from '@lucide/svelte';
	import { centroid } from './features';
	import { KIND_LABEL, STATUS_COLOR, STATUS_LABEL, type Report } from '$lib/types';

	let {
		report,
		selected = false,
		onselect
	}: { report: Report; selected?: boolean; onselect: (id: string) => void } = $props();

	const color = $derived(STATUS_COLOR[report.status]);
	const Icon = $derived(report.kind === 'spill' ? Waves : MapPin);
</script>

<Marker
	lngLat={centroid(report)}
	anchor="center"
	asButton
	zIndex={selected ? 2 : 1}
	onclick={() => onselect(report.id)}
	class="cursor-pointer"
>
	<span
		class="relative flex items-center justify-center rounded-full border-2 border-white text-white transition-transform duration-150 ease-out hover:scale-110 {selected
			? 'h-9 w-9'
			: 'h-7 w-7'}"
		style="background:{color}"
		title="{report.title} · {KIND_LABEL[report.kind]} · {STATUS_LABEL[report.status]}"
	>
		<Icon size={selected ? 18 : 15} />

		{#if report.event}
			<span
				class="absolute -right-1.5 -bottom-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-slate-900"
			>
				<CalendarCheck size={9} />
			</span>
		{/if}
	</span>
</Marker>
