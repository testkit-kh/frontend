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
	import type { Report } from '$lib/types';

	/**
	 * Раньше принимал целиком моковый Report — теперь только то, что реально
	 * рисуется: геометрию и цвет. Так компонент годится и для реальных точек
	 * (HypothesisOut отдаёт только lat/lon, не Report), и для мока.
	 */
	let { id, geometry, color }: { id: string; geometry: Report['geometry']; color: string } =
		$props();

	// Границы самой находки, а не условный zoom=15: точка и полигон площадью
	// в гектар иначе не влезают в кадр (или тонут в нём) одинаково плохо.
	const bounds = $derived(boundsOf(geometry));

	const data = $derived({
		type: 'FeatureCollection' as const,
		features: [{ type: 'Feature' as const, properties: {}, geometry }]
	});
</script>

<!-- Без h-full MapLibre схлопывается: canvas absolute, контролы не держат высоту. -->
<div class="relative h-full w-full overflow-hidden rounded-lg border border-slate-200">
	{#key id}
		<MapLibre
			class="absolute inset-0 h-full w-full"
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
				{#if geometry.type === 'Polygon'}
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
