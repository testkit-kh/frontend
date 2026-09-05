<script lang="ts">
	import {
		MapLibre,
		GeoJSON,
		FillLayer,
		LineLayer,
		CircleLayer,
		NavigationControl,
		ScaleControl
	} from 'svelte-maplibre';
	import { MAP_STYLE } from '$lib/map/style';
	import { boundsOf } from '$lib/map/features';
	import { STATUS_COLOR, type Report } from '$lib/types';

	let { report }: { report: Report } = $props();

	// Границы самой находки, а не условный zoom=15: точка и полигон площадью
	// в гектар иначе не влезают в кадр (или тонут в нём) одинаково плохо.
	const bounds = $derived(boundsOf(report.geometry));

	const data = $derived({
		type: 'FeatureCollection' as const,
		features: [{ type: 'Feature' as const, properties: {}, geometry: report.geometry }]
	});

	const color = $derived(STATUS_COLOR[report.status]);
</script>

<div class="overflow-hidden rounded-lg border border-slate-200">
	{#key report.id}
		<MapLibre
			class="h-full w-full"
			style={MAP_STYLE}
			{bounds}
			fitBoundsOptions={{ padding: 24, animate: false }}
			minZoom={11}
			maxZoom={19}
			dragRotate={false}
			pitchWithRotate={false}
			attributionControl={{ compact: true }}
		>
			<NavigationControl position="bottom-right" showCompass={false} />
			<ScaleControl position="bottom-left" />

			<GeoJSON id="subject" {data}>
				{#if report.geometry.type === 'Polygon'}
					<FillLayer paint={{ 'fill-color': color, 'fill-opacity': 0.35 }} />
					<LineLayer paint={{ 'line-color': color, 'line-width': 2 }} />
				{:else}
					<CircleLayer
						paint={{
							'circle-radius': 9,
							'circle-color': color,
							'circle-stroke-color': '#ffffff',
							'circle-stroke-width': 3
						}}
					/>
				{/if}
			</GeoJSON>
		</MapLibre>
	{/key}
</div>
