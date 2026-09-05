<script lang="ts">
	import {
		MapLibre,
		GeoJSON,
		FillLayer,
		LineLayer,
		CircleLayer,
		RasterTileSource,
		RasterLayer,
		NavigationControl,
		ScaleControl
	} from 'svelte-maplibre';
	import { ChevronDown } from '@lucide/svelte';
	import { MAP_STYLE } from '$lib/map/style';
	import { boundsOf } from '$lib/map/features';
	import type { Report } from '$lib/types';
	import type { SatelliteScene } from '$lib/api/endpoints';

	/**
	 * Раньше принимал целиком моковый Report — теперь только то, что реально
	 * рисуется: геометрию и цвет. Так компонент годится и для реальных точек
	 * (HypothesisOut отдаёт только lat/lon, не Report), и для мока.
	 *
	 * `scenes` — сцены Sentinel-2 рядом с этой точкой (satellite.listScenes /
	 * nearestScene в org/queue/+page.svelte). Пусто — сцены под этим участком
	 * ещё нет (нужен refresh), тогда рисуется только базовая карта + геометрия,
	 * без ложного «берег чистый».
	 */
	let {
		id,
		geometry,
		color,
		scenes = []
	}: {
		id: string;
		geometry: Report['geometry'];
		color: string;
		scenes?: SatelliteScene[];
	} = $props();

	let mode = $state<'rgb' | 'ndwi'>('rgb');
	let selectedSceneId = $state<string | null>(null);

	const sortedScenes = $derived([...scenes].sort((a, b) => b.datetime.localeCompare(a.datetime)));

	// Свежая сцена по умолчанию; если она пропала из списка (сменился id/scenes
	// у другой гипотезы) — переезжаем на первую доступную, а не остаёмся с
	// мёртвым выбором.
	$effect(() => {
		if (!selectedSceneId || !sortedScenes.some((s) => s.id === selectedSceneId)) {
			selectedSceneId = sortedScenes[0]?.id ?? null;
		}
	});

	const activeScene = $derived(sortedScenes.find((s) => s.id === selectedSceneId) ?? null);
	const tileUrl = $derived(
		activeScene ? (mode === 'ndwi' ? activeScene.tile_url_ndwi : activeScene.tile_url_rgb) : null
	);

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

			{#if tileUrl}
				<!-- Настоящий Sentinel-2 поверх базовой (Esri) карты, а не вместо неё:
				     пока refresh не прошёл нигде рядом, под низом остаётся хоть что-то. -->
				<RasterTileSource id="sentinel" tiles={[tileUrl]} tileSize={256} maxzoom={19}>
					<RasterLayer paint={{ 'raster-opacity': 1 }} />
				</RasterTileSource>
			{/if}

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

	{#if sortedScenes.length > 0}
		<div class="absolute top-2 left-2 z-10 flex items-center gap-1.5">
			<div class="relative">
				<select
					value={selectedSceneId}
					onchange={(event) => (selectedSceneId = event.currentTarget.value)}
					aria-label="Дата снимка Sentinel-2"
					class="min-h-8 appearance-none rounded-md border border-slate-300 bg-white py-1 pr-7 pl-2 text-xs text-slate-900 shadow-sm"
				>
					{#each sortedScenes as scene (scene.id)}
						<option value={scene.id}>{new Date(scene.datetime).toLocaleDateString('ru-RU')}</option>
					{/each}
				</select>
				<ChevronDown
					size={12}
					class="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-slate-400"
				/>
			</div>
			<button
				type="button"
				aria-pressed={mode === 'ndwi'}
				onclick={() => (mode = mode === 'ndwi' ? 'rgb' : 'ndwi')}
				title="Индекс NDWI (вода/влажность) поверх снимка"
				class="min-h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-600 shadow-sm aria-pressed:border-sky-500 aria-pressed:bg-sky-50 aria-pressed:text-sky-700"
			>
				NDWI
			</button>
		</div>
	{/if}
</div>
