<script lang="ts">
	import { Plus, ScanSearch, SquareDashed, X } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ApiError } from '$lib/api/client';
	import { hypotheses, ml } from '$lib/api/endpoints';
	import { offlineQueue } from '$lib/state/offlineQueue.svelte';
	import PollutionMap from '$lib/map/PollutionMap.svelte';
	import ReportList from '$lib/components/ReportList.svelte';
	import ReportDetails from '$lib/components/ReportDetails.svelte';
	import NewReportForm from '$lib/components/NewReportForm.svelte';
	import MapLegend from '$lib/components/MapLegend.svelte';
	import TerritoryPicker from '$lib/components/TerritoryPicker.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { ALL_TERRITORIES } from '$lib/data/territories';
	import {
		boundsFromParcels,
		geometryCentroid,
		resolveStaffTerritorySlug
	} from '$lib/data/orgTerritory';
	import type { TrashDetails } from '$lib/data/trash';
	import { hypothesisToReport, mapLayersToReports } from '$lib/map/adapters';
	import { reports } from '$lib/state/reports.svelte';
	import { session } from '$lib/state/session.svelte';
	import { territoryHealth, overallMood } from '$lib/state/health';
	import type { ReportKind, ReportStatus } from '$lib/types';

	let { data } = $props();

	const isStaff = $derived(session.isStaff);
	const authorName = $derived(session.name);

	// Слой «кому принадлежит» — дополняющий, не критичный путь: пустой список
	// при сбое не портит карту, поэтому ошибка проглатывается молча.
	let parcels = $state<GeoJSON.FeatureCollection>({ type: 'FeatureCollection', features: [] });
	$effect(() => {
		hypotheses
			.parcels(session.organizationId ?? undefined)
			.then((data) => (parcels = data as GeoJSON.FeatureCollection))
			.catch(() => {});
	});

	/** null = организация не сопоставлена с ООПТ на карте — остаёмся в обзоре / своих границах. */
	const myTerritorySlug = $derived(
		isStaff ? resolveStaffTerritorySlug(session.organization, data.territories, parcels) : null
	);
	const myTerritory = $derived(
		myTerritorySlug ? (data.territories.find((t) => t.id === myTerritorySlug) ?? null) : null
	);
	/** Есть свои границы, но нет слага каталога (кастомный OSM вроде relation/test). */
	const catalogMismatch = $derived(
		isStaff && myTerritorySlug === null && Boolean(session.organization?.has_territory)
	);

	/**
	 * Ссылка из /findings «На карте» → ?lat=&lon=.
	 * После выбора территории гасим, иначе flyTo точки блокирует fitBounds ООПТ.
	 */
	let suppressFocus = $state(false);
	let lastFocusKey = $state('');
	const focusFromUrl = $derived.by(() => {
		const lat = Number(page.url.searchParams.get('lat'));
		const lon = Number(page.url.searchParams.get('lon'));
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
		if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
		// Не уводим в «нулевой остров» у Африки из битых координат.
		if (Math.abs(lat) < 0.5 && Math.abs(lon) < 0.5) return null;
		return { lat, lon };
	});
	$effect(() => {
		const point = focusFromUrl;
		if (!point) return;
		const key = `${point.lat},${point.lon}`;
		if (key !== lastFocusKey) {
			lastFocusKey = key;
			suppressFocus = false;
		}
	});
	const focus = $derived(suppressFocus ? null : focusFromUrl);

	let mapApi = $state<{
		getMapBounds: () => {
			bbox: [number, number, number, number];
			zoom: number;
		} | null;
		fitActive: () => void;
	} | null>(null);
	/** Принудительный fitBounds при клике «Моя территория» / смене ООПТ. */
	let viewEpoch = $state(0);

	let mlOverlay = $state<GeoJSON.FeatureCollection>({ type: 'FeatureCollection', features: [] });
	/** Ручной тумблер «Слой ML». Автоматически слой ещё виден, пока открыто окошко ИИ. */
	let mlLayerManual = $state(false);
	let mlScanning = $state(false);
	let mlNote = $state<string | null>(null);
	/** Рисование полигона для ИИ-проверки (отдельно от гипотез волонтёра). */
	let mlDraw = $state(false);
	let mlDraft = $state<[number, number][]>([]);

	const mlPanelOpen = $derived(mlDraw || mlScanning || Boolean(mlNote));
	const mlVisible = $derived(mlLayerManual || mlPanelOpen);

	const mlMarkers = $derived.by(() => {
		const out: Array<{
			id: string;
			lon: number;
			lat: number;
			label: string;
			color?: string | null;
		}> = [];
		for (const feature of mlOverlay.features) {
			const props = (feature.properties ?? {}) as Record<string, unknown>;
			const id = String(props.id ?? props.detection_id ?? out.length);
			let lon = Number(props.lon);
			let lat = Number(props.lat);
			if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
				const c = geometryCentroid(feature.geometry);
				if (!c) continue;
				[lon, lat] = c;
			}
			if (Math.abs(lon) < 0.5 && Math.abs(lat) < 0.5) continue;
			out.push({
				id,
				lon,
				lat,
				label: String(props.label_ru ?? props.trash_category ?? 'Находка ML'),
				color: typeof props.color === 'string' ? props.color : (props.color_hex as string | null)
			});
		}
		return out;
	});

	async function refreshMlOverlay(scanId?: string) {
		try {
			mlOverlay = await ml.overlayGeojson({ limit: 30, scan_id: scanId });
		} catch {
			/* слой необязателен при первом открытии */
		}
	}

	$effect(() => {
		if (!session.profile) return;
		refreshMlOverlay();
	});

	// С /findings «На карте» — показать слой ML у точки.
	$effect(() => {
		if (focus) mlLayerManual = true;
	});

	function bboxFromRing(ring: [number, number][]): [number, number, number, number] {
		const lngs = ring.map(([lng]) => lng);
		const lats = ring.map(([, lat]) => lat);
		return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
	}

	function zoomForBbox(bbox: [number, number, number, number]): number {
		const span = Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1]);
		if (span > 0.5) return 14;
		if (span > 0.15) return 15;
		if (span > 0.05) return 16;
		if (span > 0.02) return 17;
		return 18;
	}

	/** Сколько тайлов уйдёт в detect/area — от этого и оценка времени. */
	function estimateTileCount(bbox: [number, number, number, number], zoom: number): number {
		const z = Math.min(19, Math.max(1, Math.round(zoom)));
		const n = 2 ** z;
		const lon2x = (lon: number) => ((lon + 180) / 360) * n;
		const lat2y = (lat: number) => {
			const rad = (lat * Math.PI) / 180;
			return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
		};
		const [west, south, east, north] = bbox;
		const x0 = Math.floor(lon2x(west));
		const x1 = Math.floor(lon2x(east));
		const y0 = Math.floor(lat2y(north));
		const y1 = Math.floor(lat2y(south));
		return Math.max(1, (x1 - x0 + 1) * (y1 - y0 + 1));
	}

	/** Эмпирика: ~0.3–0.8 с на тайл (скачать + эвристика/модель). */
	function formatScanEta(tiles: number): { label: string; low: number; high: number } {
		const low = Math.max(2, Math.round(tiles * 0.3));
		const high = Math.max(low + 1, Math.round(tiles * 0.75));
		const fmt = (s: number) =>
			s < 60 ? `${s} с` : `${Math.floor(s / 60)} мин ${s % 60 ? `${s % 60} с` : ''}`.trim();
		return {
			low,
			high,
			label: low === high ? `~${fmt(low)}` : `~${fmt(low)} – ${fmt(high)}`
		};
	}

	const mlPreview = $derived.by(() => {
		if (mlDraft.length < 2) return null;
		const bbox = bboxFromRing(mlDraft);
		const zoom = zoomForBbox(bbox);
		const tiles = estimateTileCount(bbox, zoom);
		return { bbox, zoom, tiles, eta: formatScanEta(tiles) };
	});

	let mlScanStartedAt = $state<number | null>(null);
	let mlElapsedSec = $state(0);
	$effect(() => {
		if (!mlScanning || mlScanStartedAt == null) {
			mlElapsedSec = 0;
			return;
		}
		const tick = () => {
			mlElapsedSec = Math.max(0, Math.round((Date.now() - mlScanStartedAt!) / 1000));
		};
		tick();
		const id = setInterval(tick, 500);
		return () => clearInterval(id);
	});

	async function runMlScan(bbox: [number, number, number, number], zoom: number) {
		mlScanning = true;
		mlScanStartedAt = Date.now();
		mlNote = null;
		const eta = formatScanEta(estimateTileCount(bbox, zoom));
		try {
			const scan = await ml.createScan({
				bbox,
				zoom: Math.min(19, Math.max(zoom, 15))
			});
			if (scan.geojson?.features?.length) {
				mlOverlay = scan.geojson;
			} else {
				await refreshMlOverlay(scan.id);
			}
			const count = scan.summary?.count ?? scan.findings_count ?? mlOverlay.features.length;
			const elapsed = Math.max(
				1,
				Math.round((Date.now() - (mlScanStartedAt ?? Date.now())) / 1000)
			);
			const parts = [
				`Найдено объектов: ${count}`,
				`заняло ${elapsed} с (оценка была ${eta.label})`
			];
			if (scan.candidates_suppressed || scan.imagery?.too_coarse) {
				parts.push(
					'Подложка грубая — кандидаты в очередь ООПТ не создавались (нормально для публичных тайлов).'
				);
			} else if (scan.hypotheses_created > 0) {
				parts.push(`В очередь валидации: ${scan.hypotheses_created}`);
			}
			if (scan.imagery?.attribution) parts.push(scan.imagery.attribution);
			mlNote = parts.join(' · ');
		} catch (cause) {
			mlNote =
				cause instanceof ApiError
					? cause.message
					: 'Не удалось выполнить ML-скан. Проверьте, что сервис ml.* доступен.';
		} finally {
			mlScanning = false;
			mlScanStartedAt = null;
		}
	}

	async function scanViewport() {
		if (mlScanning || !mapApi) return;
		const view = mapApi.getMapBounds();
		if (!view) {
			mlNote = 'Карта ещё не готова.';
			return;
		}
		if (view.zoom < 14) {
			mlNote = 'Приблизьте карту (зум ≥ 14) или нарисуйте полигон кнопкой «Проверить ИИ».';
			return;
		}
		await runMlScan(view.bbox, view.zoom);
	}

	function startMlDraw() {
		mlDraw = true;
		drawing = false;
		draftPoint = null;
		draftArea = [];
		mlDraft = [];
		selectedId = null;
		sheetSnap = 'peek';
		mlNote = null;
	}

	function cancelMlDraw() {
		mlDraw = false;
		mlDraft = [];
	}

	async function submitMlDraw() {
		if (mlDraft.length < 3 || mlScanning) return;
		const bbox = bboxFromRing(mlDraft);
		const zoom = zoomForBbox(bbox);
		mlDraw = false;
		mlDraft = [];
		await runMlScan(bbox, zoom);
	}
	/**
	 * Настоящие точки с бэкенда.
	 *
	 * Своими (`/hypotheses/my`) карта обязана: без них человек отправляет
	 * наблюдение и после перезагрузки его не находит — самый обидный способ
	 * потерять волонтёра. Подтверждённые чужие берутся из `/map/layers`: это
	 * общая картина загрязнений, ради которой карта и существует.
	 *
	 * Сбой любой из двух загрузок не ломает экран: остаются демо-точки, и об
	 * этом честно говорит плашка ниже.
	 */
	let remoteError = $state(false);
	let loadedFor: string | null = null;
	$effect(() => {
		const profileId = session.profile?.id;
		if (!profileId || loadedFor === profileId) return;
		loadedFor = profileId;

		Promise.allSettled([
			session.role === 'volunteer'
				? hypotheses.mine({ limit: 100 }) // потолок ручки — 100
				: Promise.resolve({ items: [], total: 0 }),
			hypotheses.mapLayers()
		]).then(([mine, layers]) => {
			const own =
				mine.status === 'fulfilled'
					? mine.value.items.map((h) => hypothesisToReport(h, data.territories, authorName))
					: [];
			const approved =
				layers.status === 'fulfilled' ? mapLayersToReports(layers.value, data.territories) : [];

			// Свои точки первыми: у них есть причина отказа и статус проверки,
			// а в общем слое та же точка обезличена.
			const ownIds = new Set(own.map((r) => r.id));
			reports.mergeRemote([...own, ...approved.filter((r) => !ownIds.has(r.id))]);
			remoteError = mine.status === 'rejected' && layers.status === 'rejected';
		});
	});

	/** Свои границы без слага каталога — отдельный режим «дома». */
	const HOME_ID = '__home__';
	const parcelBounds = $derived(boundsFromParcels(parcels));
	const homeId = $derived(myTerritorySlug ?? (parcelBounds ? HOME_ID : null));

	let picked = $state<string | null>(null);
	const activeId = $derived(picked ?? homeId ?? ALL_TERRITORIES);
	const homeActive = $derived(activeId === HOME_ID);
	/** null — обзор страны или «дом» по своим участкам. */
	const territory = $derived(
		activeId === ALL_TERRITORIES || activeId === HOME_ID
			? null
			: (data.territories.find((t) => t.id === activeId) ?? null)
	);
	const overview = $derived(activeId === ALL_TERRITORIES);
	const mapHomeBounds = $derived(homeActive ? parcelBounds : null);

	let selectedId = $state<string | null>(null);
	let sheetSnap = $state<'peek' | 'half' | 'full'>('half');
	let drawing = $state(false);
	let kind = $state<ReportKind>('trash');
	let draftPoint = $state<[number, number] | null>(null);
	let draftArea = $state<[number, number][]>([]);

	const visible = $derived(isStaff ? reports.items : reports.visibleTo(authorName));
	const inTerritory = $derived(
		overview || homeActive ? visible : visible.filter((r) => r.territoryId === territory!.id)
	);

	let filter = $state<'all' | ReportStatus>('all');
	const shown = $derived(
		filter === 'all' ? inTerritory : inTerritory.filter((r) => r.status === filter)
	);

	const health = $derived(
		overview || homeActive || !territory
			? {
					open: inTerritory.filter((r) => r.status !== 'rejected').length,
					mood: overallMood(visible)
				}
			: territoryHealth(visible, territory.id)
	);

	const selected = $derived(reports.items.find((r) => r.id === selectedId) ?? null);

	let routeShown = $state(false);
	let lastSelected: string | null = null;
	$effect(() => {
		if (lastSelected === selectedId) return;
		lastSelected = selectedId;
		routeShown = false;
	});
	const route = $derived(routeShown ? (selected?.route ?? null) : null);

	const legend = $derived<ReportStatus[]>(
		isStaff ? ['confirmed', 'pending', 'drone', 'rejected'] : ['confirmed', 'pending']
	);

	const FILTERS: Array<{ value: 'all' | ReportStatus; label: string }> = [
		{ value: 'all', label: 'Все' },
		{ value: 'confirmed', label: 'Подтверждённые' },
		{ value: 'pending', label: 'На проверке' }
	];

	let lastTerritory = '';
	$effect(() => {
		if (lastTerritory === activeId) return;
		lastTerritory = activeId;
		selectedId = null;
	});

	function mapClick(coordinates: [number, number]) {
		if (mlDraw) {
			mlDraft = [...mlDraft, coordinates];
			return;
		}
		if (kind === 'trash') draftPoint = coordinates;
		else draftArea = [...draftArea, coordinates];
	}

	function undo() {
		if (mlDraw) {
			mlDraft = mlDraft.slice(0, -1);
			return;
		}
		if (kind === 'trash') draftPoint = null;
		else draftArea = draftArea.slice(0, -1);
	}

	function startDrawing() {
		cancelMlDraw();
		drawing = true;
		// Наполовину, а не целиком: человек ставит точку на карте, и форма не
		// должна её закрывать.
		sheetSnap = 'half';
		selectedId = null;
	}

	function cancelDrawing() {
		drawing = false;
		draftPoint = null;
		draftArea = [];
	}

	function submit({
		title,
		note,
		photo,
		trash
	}: {
		title: string;
		note: string;
		photo: File | null;
		trash?: TrashDetails;
	}) {
		const territoryId = territory?.id ?? data.territories[0].id;

		if (kind === 'trash') {
			// Реальная отправка — через офлайн-очередь (см. offlineQueue.svelte.ts):
			// она сама решает, слать ли сейчас или ждать связи, и сама зеркалит
			// результат в этот же мок-стор, поэтому здесь `reports.add` не нужен.
			const [lon, lat] = draftPoint!;
			offlineQueue.enqueue(
				{
					lat,
					lon,
					description: note || title,
					title,
					territoryId,
					authorName,
					trash
				},
				photo
			);
			cancelDrawing();
			return;
		}

		// «Разлив» рисуется полигоном, а у бэкенда Hypothesis нет геометрии
		// сложнее точки (lat/lon) — вне контракта P0-1, остаётся мок-only.
		const report = reports.add({
			territoryId,
			kind,
			source: 'satellite',
			title,
			note,
			author: authorName,
			geometry: { type: 'Polygon', coordinates: [[...draftArea, draftArea[0]]] }
		});
		cancelDrawing();
		selectedId = report.id;
	}

	function clearMapFocusFromUrl() {
		if (!page.url.searchParams.has('lat') && !page.url.searchParams.has('lon')) return;
		const next = new URL(page.url);
		next.searchParams.delete('lat');
		next.searchParams.delete('lon');
		void goto(`${next.pathname}${next.search}${next.hash}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	function selectTerritory(id: string) {
		suppressFocus = true;
		clearMapFocusFromUrl();
		picked = id;
		selectedId = null;
		sheetSnap = 'half';
		viewEpoch += 1;
	}

	// Рисовать точку в обзоре страны нельзя: непонятно, к какой территории её
	// отнести, да и попасть пальцем в берег на таком масштабе невозможно.
	const canDraw = $derived(!isStaff && !overview);
</script>

<svelte:head><title>Карта · Чистый берег</title></svelte:head>

<div class="absolute inset-0">
	<PollutionMap
		bind:mapApi
		items={shown}
		territories={data.territories}
		activeTerritory={territory}
		{selectedId}
		onselect={(id) => (selectedId = id)}
		{route}
		drawMode={mlDraw ? 'area' : drawing ? (kind === 'trash' ? 'point' : 'area') : 'off'}
		draft={mlDraw ? mlDraft : kind === 'trash' ? (draftPoint ? [draftPoint] : []) : draftArea}
		onmapclick={mapClick}
		onterritory={selectTerritory}
		{parcels}
		{mlOverlay}
		{mlVisible}
		{mlMarkers}
		{focus}
		{viewEpoch}
		homeBounds={mapHomeBounds}
	/>
</div>

<!-- Компактные кнопки слева сверху — не перекрывают сайдбар (он тоже слева,
     но кнопки узкие). Панель рисования ИИ — справа. -->
<div
	class="absolute top-4 left-4 z-20 flex max-w-[min(100%-2rem,16rem)] flex-col gap-2 md:left-[calc(1rem+20rem+0.75rem)]"
	style="padding-top: env(safe-area-inset-top)"
>
	<div class="flex flex-wrap gap-2">
		<button
			type="button"
			aria-pressed={mlVisible}
			onclick={() => (mlLayerManual = !mlLayerManual)}
			class="min-h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm aria-pressed:border-violet-300 aria-pressed:bg-violet-50 aria-pressed:text-violet-900"
		>
			Слой ML
		</button>
		{#if isStaff || session.hasMapAccess}
			<button
				type="button"
				disabled={mlScanning || overview || mlDraw}
				onclick={scanViewport}
				class="flex min-h-9 items-center gap-1.5 rounded-full bg-slate-900 px-3 text-xs font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
			>
				<ScanSearch size={14} />
				{mlScanning ? '…' : 'Скан'}
			</button>
			<button
				type="button"
				disabled={mlScanning}
				onclick={() => (mlDraw ? cancelMlDraw() : startMlDraw())}
				class="flex min-h-9 items-center gap-1.5 rounded-full bg-slate-900 px-3 text-xs font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
			>
				<SquareDashed size={14} />
				Проверить ИИ
			</button>
		{/if}
	</div>
</div>

{#if mlDraw || mlScanning || mlNote}
	<!-- Правая карточка: не пересекается с BottomSheet (слева на md, снизу на mobile). -->
	<aside
		class="absolute top-4 right-4 z-20 flex w-[min(100%-2rem,18rem)] flex-col gap-3 rounded-xl border border-violet-200 bg-white/95 p-3 shadow-lg backdrop-blur"
		style="padding-top: max(0.75rem, env(safe-area-inset-top)); margin-bottom: env(safe-area-inset-bottom)"
		aria-label="Проверка ИИ"
	>
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0">
				<p class="text-sm font-semibold text-violet-950">
					{#if mlScanning}
						ИИ считает…
					{:else if mlDraw}
						Полигон для ИИ
					{:else}
						Результат ИИ
					{/if}
				</p>
				<p class="mt-0.5 text-[11px] leading-snug text-slate-500">
					{#if mlDraw}
						Кликайте по карте (≥3 точки), затем отправьте.
					{:else if mlScanning}
						Не закрывайте вкладку — идёт загрузка тайлов и детекция.
					{:else}
						Фиолетовый слой и маркеры на карте.
					{/if}
				</p>
			</div>
			<button
				type="button"
				onclick={() => {
					if (mlScanning) return;
					cancelMlDraw();
					mlNote = null;
				}}
				disabled={mlScanning}
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
				aria-label="Закрыть"
			>
				<X size={16} />
			</button>
		</div>

		{#if mlDraw}
			<div class="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-950">
				<p>
					Точек: <span class="font-semibold">{mlDraft.length}</span>
					{#if mlDraft.length < 3}
						<span class="text-violet-700"> · нужно ещё {3 - mlDraft.length}</span>
					{/if}
				</p>
				{#if mlPreview}
					<p class="mt-1 text-violet-800">
						~{mlPreview.tiles} тайл{mlPreview.tiles === 1 ? '' : mlPreview.tiles < 5 ? 'а' : 'ов'} · зум
						{mlPreview.zoom}
					</p>
					<p class="mt-0.5 font-medium text-violet-900">
						Оценка рендера: {mlPreview.eta.label}
					</p>
				{:else}
					<p class="mt-1 text-violet-700">Поставьте ещё точки — появится оценка времени.</p>
				{/if}
			</div>

			<div class="flex gap-2">
				<button
					type="button"
					onclick={cancelMlDraw}
					class="min-h-10 flex-1 rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
				>
					Отменить
				</button>
				<button
					type="button"
					disabled={mlDraft.length === 0}
					onclick={undo}
					class="min-h-10 rounded-full border border-slate-200 px-3 text-xs text-slate-600 disabled:opacity-40"
				>
					Undo
				</button>
			</div>
			<button
				type="button"
				disabled={mlDraft.length < 3 || mlScanning}
				onclick={submitMlDraw}
				class="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-violet-700 px-4 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-40"
			>
				<ScanSearch size={16} />
				Отправить ИИ
				{#if mlPreview}
					<span class="font-normal opacity-90">· {mlPreview.eta.label}</span>
				{/if}
			</button>
		{:else if mlScanning}
			<div class="rounded-lg bg-violet-50 px-3 py-3 text-xs text-violet-950">
				<p class="font-medium">Идёт рендер…</p>
				<p class="mt-1 text-violet-800 tabular-nums">Прошло {mlElapsedSec} с</p>
				<p class="mt-2 text-[11px] text-violet-700">
					Обычно от нескольких секунд до пары минут — зависит от площади и зума.
				</p>
				<div class="mt-3 h-1.5 overflow-hidden rounded-full bg-violet-200">
					<div
						class="h-full animate-pulse rounded-full bg-violet-600"
						style="width: {Math.min(92, 12 + mlElapsedSec * 4)}%"
					></div>
				</div>
			</div>
			<button
				type="button"
				disabled
				class="min-h-10 w-full rounded-full border border-slate-200 text-xs text-slate-400"
			>
				Отмена недоступна во время скана
			</button>
		{:else if mlNote}
			<p class="text-xs leading-relaxed text-slate-700">{mlNote}</p>
			<button
				type="button"
				onclick={() => (mlNote = null)}
				class="min-h-10 w-full rounded-full border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
			>
				Закрыть
			</button>
		{/if}
	</aside>
{/if}

<BottomSheet bind:snap={sheetSnap} label={drawing ? 'Новая гипотеза' : 'Точки загрязнения'}>
	{#snippet header()}
		{#if !drawing}
			<div class="flex flex-col gap-3 border-b border-slate-200 px-4 pb-4 md:pt-4">
				<div class="flex items-start gap-3">
					<Logo mood={health.mood} size={36} />
					<div class="min-w-0 flex-1">
						<h1 class="truncate text-base font-semibold text-slate-900">
							{territory?.name ??
								(homeActive ? (myTerritory?.name ?? 'Моя территория') : 'Вся Россия')}
						</h1>
						<p
							class="mt-0.5 text-xs {health.mood === 'dirty'
								? 'text-orange-600'
								: 'text-slate-500'}"
						>
							{health.open} точек ждут работы
							{#if !overview}· {shown.length} из {inTerritory.length} показано{/if}
						</p>
					</div>
				</div>

				{#if remoteError}
					<!-- Молчать нельзя: человек увидит демо-точки и решит, что его
					     наблюдение пропало. -->
					<p class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
						Сервер не ответил — показаны демонстрационные точки. Ваши наблюдения не потеряны, они
						появятся, когда связь восстановится.
					</p>
				{/if}

				{#if catalogMismatch && !homeActive}
					<p class="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
						Границы заданы, но OSM-id не из каталога ООПТ
						{#if session.organization?.territory_osm_id}
							({session.organization.territory_osm_id})
						{/if}
						— откройте «Моя территория» по вашим участкам. Юрлицо в шапке — оператор, не название ООПТ.
					</p>
				{:else if isStaff && myTerritorySlug === null && !session.organization?.has_territory}
					<p class="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
						Задайте границы территории в кабинете ООПТ — иначе карта остаётся в обзоре страны.
					</p>
				{/if}

				<TerritoryPicker
					territories={data.territories}
					value={activeId === HOME_ID ? (homeId ?? ALL_TERRITORIES) : activeId}
					onchange={selectTerritory}
					locked={isStaff}
					myTerritoryId={homeId}
				/>

				<div class="flex gap-1 rounded-full bg-slate-100 p-1 text-xs">
					{#each FILTERS as option (option.value)}
						<button
							type="button"
							aria-pressed={filter === option.value}
							onclick={() => (filter = option.value)}
							class="min-h-9 flex-1 rounded-full px-3 text-slate-600 aria-pressed:bg-white aria-pressed:font-medium aria-pressed:text-slate-900"
						>
							{option.label}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	{/snippet}

	{#if drawing}
		<NewReportForm
			{kind}
			{draftPoint}
			{draftArea}
			onkind={(next) => {
				kind = next;
				draftPoint = null;
				draftArea = [];
			}}
			onundo={undo}
			oncancel={cancelDrawing}
			onsubmit={submit}
		/>
	{:else if overview}
		<p class="px-4 py-6 text-sm text-slate-500">
			Показаны все {data.territories.length} территорий проекта. Нажмите метку на карте или выберите территорию,
			чтобы увидеть точки.
		</p>
	{:else}
		<ReportList
			items={shown}
			{selectedId}
			onselect={(id) => {
				selectedId = id;
				sheetSnap = 'peek';
			}}
			empty="В этом фильтре точек нет."
		/>
	{/if}

	{#snippet footer()}
		{#if canDraw && !drawing}
			<div class="p-4">
				<button
					type="button"
					onclick={startDrawing}
					class="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700"
				>
					<Plus size={16} /> Сообщить о загрязнении
				</button>
			</div>
		{/if}
	{/snippet}
</BottomSheet>

<!-- Легенда только на широком экране: на телефоне её место занимает лист. -->
<div class="pointer-events-none absolute inset-x-4 bottom-4 z-0 hidden justify-center md:flex">
	<div class="pointer-events-auto">
		<MapLegend statuses={legend} />
	</div>
</div>

{#if selected}
	<!-- Карточка точки перекрывает лист: на телефоне это единственный способ
	     показать подробности, не отнимая у карты остаток экрана. -->
	<div
		class="absolute inset-x-0 bottom-0 z-20 max-h-[80dvh] md:inset-x-auto md:top-4 md:right-4 md:bottom-4 md:w-96"
		style="padding-bottom: env(safe-area-inset-bottom)"
	>
		<ReportDetails
			report={selected}
			role={isStaff ? 'staff' : 'volunteer'}
			{routeShown}
			ontoggleroute={() => (routeShown = !routeShown)}
			onclose={() => {
				selectedId = null;
				sheetSnap = 'half';
			}}
		/>
	</div>
{/if}

{#if drawing}
	<button
		type="button"
		onclick={cancelDrawing}
		aria-label="Отменить"
		class="absolute top-4 right-4 z-20 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 md:hidden"
	>
		<X size={18} />
	</button>
{/if}
