<script lang="ts">
	import {
		MapLibre,
		GeoJSON,
		CircleLayer,
		FillLayer,
		LineLayer,
		MapEvents,
		NavigationControl,
		Popup,
		ScaleControl,
		SymbolLayer
	} from 'svelte-maplibre';
	import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
	import type { LayerClickInfo } from 'svelte-maplibre';
	import { untrack } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import type { Report } from '$lib/types';
	import { territoriesFeature, type Territory } from '$lib/data/territories';
	import { healthByTerritory } from '$lib/state/health';
	import { FIT_PADDING, MAP_STYLE, RUSSIA_BOUNDS, STATUS_MATCH, hovered } from './style';
	import { centroid, territoryPins, toAreas, toPoints } from './features';
	import ReportMarker from './ReportMarker.svelte';
	import TerritoryPin from './TerritoryPin.svelte';

	/** Выше этого числа точек в территории DOM-маркеры на все репорты не
	 *  тянут — переключаемся на GeoJSON-слой с кластеризацией. Ниже —
	 *  оставляем текущий вид (иконка по типу, бейдж мероприятия). */
	const CLUSTER_THRESHOLD = 60;

	let {
		items,
		territories,
		activeTerritory,
		selectedId = null,
		onselect,
		route = null,
		drawMode = 'off',
		draft = [],
		onmapclick,
		onterritory,
		parcels = { type: 'FeatureCollection', features: [] }
	}: {
		items: Report[];
		territories: Territory[];
		/** null — обзор всей страны. */
		activeTerritory: Territory | null;
		selectedId?: string | null;
		onselect?: (id: string) => void;
		route?: Report['route'] | null;
		drawMode?: 'off' | 'point' | 'area';
		draft?: [number, number][];
		onmapclick?: (coordinates: [number, number]) => void;
		/** Клик по метке территории в обзорном режиме. */
		onterritory?: (id: string) => void;
		/** Кадастровые участки — «кому принадлежит» (GET /api/v1/map/parcels.geojson). */
		parcels?: GeoJSON.FeatureCollection;
	} = $props();

	const overview = $derived(activeTerritory === null);
	const health = $derived(healthByTerritory(items));
	const pins = $derived(overview ? territoryPins(territories, health) : { features: [] });

	let map = $state<MapLibreMap | undefined>();

	const areas = $derived(toAreas(items));
	const boundaries = $derived(territoriesFeature(territories));
	const points = $derived(toPoints(items));
	const useClusters = $derived(!overview && items.length > CLUSTER_THRESHOLD);

	function expandCluster(event: LayerClickInfo) {
		const clusterId = Number(event.clusterId);
		if (!map || Number.isNaN(clusterId)) return;
		const source = map.getSource('points') as GeoJSONSource | undefined;
		const lngLat = event.event.lngLat;
		source?.getClusterExpansionZoom(clusterId).then((zoom) => {
			map?.easeTo({ center: lngLat, zoom });
		});
	}

	const routeData = $derived({
		type: 'FeatureCollection' as const,
		features: route ? [{ type: 'Feature' as const, properties: {}, geometry: route.geometry }] : []
	});

	// В обзоре подсвечивать «активную» территорию нечего — выделены все.
	const isActive: ExpressionSpecification = $derived([
		'==',
		['get', 'id'],
		activeTerritory?.id ?? '__none__'
	]);

	const draftData = $derived({
		type: 'FeatureCollection' as const,
		features: draft.length
			? [
					{
						type: 'Feature' as const,
						properties: {},
						geometry:
							draft.length >= 3
								? { type: 'Polygon' as const, coordinates: [[...draft, draft[0]]] }
								: { type: 'LineString' as const, coordinates: draft }
					}
				]
			: []
	});

	const draftPoints = $derived({
		type: 'FeatureCollection' as const,
		features: draft.map((coordinates) => ({
			type: 'Feature' as const,
			properties: {},
			geometry: { type: 'Point' as const, coordinates }
		}))
	});

	const isSelected: ExpressionSpecification = $derived(['==', ['get', 'id'], selectedId ?? '']);

	$effect(() => {
		if (import.meta.env.DEV && map) (window as unknown as { __map: unknown }).__map = map;
	});

	$effect(() => {
		if (!map) return;
		map.touchZoomRotate.disableRotation();
		map.touchPitch.disable();
		map.keyboard.disableRotation();
	});

	$effect(() => {
		const bounds = activeTerritory?.bounds ?? RUSSIA_BOUNDS;
		untrack(() => map?.fitBounds(bounds, { padding: FIT_PADDING, animate: false }));
	});

	$effect(() => {
		const id = selectedId;
		untrack(() => {
			const report = items.find((r) => r.id === id);
			if (!report || !map) return;
			map.flyTo({
				center: centroid(report),
				zoom: Math.max(map.getZoom(), 14),
				duration: prefersReducedMotion.current ? 0 : 700
			});
		});
	});

	function pick(id: unknown) {
		if (typeof id === 'string') onselect?.(id);
	}
</script>

<MapLibre
	bind:map
	class="h-full w-full"
	style={MAP_STYLE}
	bounds={activeTerritory?.bounds ?? RUSSIA_BOUNDS}
	fitBoundsOptions={{ padding: FIT_PADDING }}
	minZoom={3}
	maxZoom={18}
	dragRotate={false}
	pitchWithRotate={false}
	attributionControl={{ compact: true }}
>
	<NavigationControl position="bottom-right" showCompass={false} />
	<ScaleControl position="bottom-left" />

	<MapEvents
		onclick={(event) => {
			if (drawMode === 'off') return;
			onmapclick?.([event.lngLat.lng, event.lngLat.lat]);
		}}
	/>

	<GeoJSON id="territories" data={boundaries}>
		<FillLayer
			paint={{
				'fill-color': '#38bdf8',
				'fill-opacity': overview ? 0.08 : ['case', isActive, 0.06, 0.02]
			}}
		/>
		<LineLayer
			paint={{
				'line-color': overview ? '#e2e8f0' : ['case', isActive, '#e2e8f0', '#94a3b8'],
				'line-width': overview ? 1.4 : ['case', isActive, 1.8, 1],
				'line-opacity': overview ? 0.7 : ['case', isActive, 0.8, 0.4],
				'line-dasharray': [3, 2]
			}}
		/>
	</GeoJSON>

	<!-- Кадастровые участки — «кому принадлежит», отдельно от собственных
	     полигонов-находок (areas): один описывает территорию владения, другой —
	     то, что на ней нашли, путать их в одном слое нельзя. -->
	<GeoJSON id="parcels" data={parcels}>
		<FillLayer hoverCursor="pointer" paint={{ 'fill-color': '#a855f7', 'fill-opacity': 0.18 }}>
			<Popup openOn="click" closeOnClickOutside>
				{#snippet children({ data })}
					{@const props = (data?.properties ?? {}) as { name?: string; description?: string }}
					<div class="max-w-64 text-xs">
						<p class="font-medium text-slate-900">{props.name ?? 'Кадастровый участок'}</p>
						{#if props.description}
							<p class="mt-1 text-slate-600">{props.description}</p>
						{/if}
					</div>
				{/snippet}
			</Popup>
		</FillLayer>
		<LineLayer paint={{ 'line-color': '#a855f7', 'line-width': 1.4, 'line-opacity': 0.6 }} />
	</GeoJSON>

	<GeoJSON id="areas" data={areas}>
		<FillLayer
			manageHoverState
			hoverCursor="pointer"
			paint={{
				'fill-color': STATUS_MATCH,
				'fill-opacity': ['case', isSelected, 0.5, hovered, 0.42, 0.28]
			}}
			onclick={(event) => {
				if (drawMode !== 'off') return;
				pick(event.features?.[0]?.properties?.id);
			}}
		/>
		<LineLayer
			paint={{
				'line-color': STATUS_MATCH,
				'line-width': ['case', isSelected, 3, 1.8],
				'line-opacity': 0.95
			}}
		/>
	</GeoJSON>

	<GeoJSON id="route" data={routeData}>
		<LineLayer
			layout={{ 'line-cap': 'round', 'line-join': 'round' }}
			paint={{ 'line-color': '#0f172a', 'line-width': 6, 'line-opacity': 0.5 }}
		/>
		<LineLayer
			layout={{ 'line-cap': 'round', 'line-join': 'round' }}
			paint={{ 'line-color': '#fbbf24', 'line-width': 2.5 }}
		/>
	</GeoJSON>

	{#if overview}
		<!-- На масштабе страны отдельные точки сливаются: показываем по метке
		     на территорию, клик уводит внутрь. -->
		{#each pins.features as pin (pin.properties.id)}
			<TerritoryPin
				coordinates={pin.geometry.coordinates}
				name={pin.properties.name}
				open={pin.properties.open}
				mood={pin.properties.mood}
				onselect={() => onterritory?.(pin.properties.id)}
			/>
		{/each}
	{:else if useClusters}
		<!-- На большом числе точек DOM-маркеры на каждую тормозят и сливаются
		     в кашу — переключаемся на кластеризованный GeoJSON-слой. -->
		<GeoJSON id="points" data={points} cluster={{ radius: 50, maxZoom: 14 }}>
			<CircleLayer
				filter={['has', 'point_count']}
				hoverCursor="pointer"
				paint={{
					'circle-color': '#0f172a',
					'circle-opacity': 0.85,
					'circle-radius': ['step', ['get', 'point_count'], 16, 25, 20, 100, 26],
					'circle-stroke-color': '#ffffff',
					'circle-stroke-width': 2
				}}
				onclick={expandCluster}
			/>
			<SymbolLayer
				filter={['has', 'point_count']}
				layout={{
					'text-field': ['get', 'point_count_abbreviated'],
					'text-size': 12,
					'text-font': ['Noto Sans Bold']
				}}
				paint={{ 'text-color': '#ffffff' }}
			/>
			<CircleLayer
				filter={['!', ['has', 'point_count']]}
				manageHoverState
				hoverCursor="pointer"
				paint={{
					'circle-color': STATUS_MATCH,
					'circle-radius': ['case', isSelected, 9, 6],
					'circle-stroke-color': '#ffffff',
					'circle-stroke-width': 2
				}}
				onclick={(event) => {
					if (drawMode !== 'off') return;
					pick(event.features?.[0]?.properties?.id);
				}}
			/>
		</GeoJSON>
	{:else}
		{#each items as report (report.id)}
			<ReportMarker
				{report}
				selected={report.id === selectedId}
				onselect={(id) => pick(id)}
				interactive={drawMode === 'off'}
			/>
		{/each}
	{/if}

	<GeoJSON id="draft" data={draftData}>
		<FillLayer paint={{ 'fill-color': '#f472b6', 'fill-opacity': 0.25 }} />
		<LineLayer paint={{ 'line-color': '#f472b6', 'line-width': 2, 'line-dasharray': [2, 1.5] }} />
	</GeoJSON>
	<GeoJSON id="draft-points" data={draftPoints}>
		<CircleLayer
			paint={{
				'circle-radius': 5,
				'circle-color': '#f472b6',
				'circle-stroke-color': '#ffffff',
				'circle-stroke-width': 2
			}}
		/>
	</GeoJSON>
</MapLibre>
