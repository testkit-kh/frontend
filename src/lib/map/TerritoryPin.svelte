<script lang="ts">
	import { Marker } from 'svelte-maplibre';
	import Logo from '$lib/components/Logo.svelte';
	import type { Mood } from '$lib/state/health';

	let {
		coordinates,
		name,
		open,
		mood,
		onselect
	}: {
		coordinates: [number, number];
		name: string;
		open: number;
		mood: Mood;
		onselect: () => void;
	} = $props();
</script>

<Marker lngLat={coordinates} class="cursor-pointer">
	<button
		type="button"
		onclick={onselect}
		aria-label="{name}: {open} открытых точек"
		class="flex min-h-11 items-center gap-1.5 rounded-full border border-white/70 bg-white/95 py-1.5 pr-3 pl-1.5 text-left backdrop-blur transition-transform hover:scale-105"
	>
		<Logo {mood} size={26} />
		<span class="flex flex-col leading-tight">
			<span class="text-xs font-medium whitespace-nowrap text-slate-900">{name}</span>
			<span class="text-[11px] {mood === 'dirty' ? 'text-orange-600' : 'text-slate-500'}">
				{open} открытых
			</span>
		</span>
	</button>
</Marker>
