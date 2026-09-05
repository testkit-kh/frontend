<script lang="ts">
	import { Plus, X } from '@lucide/svelte';
	import { hypotheses } from '$lib/api/endpoints';
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

	let picked = $state<string | null>(null);
	const activeId = $derived(picked ?? session.organizationId ?? ALL_TERRITORIES);
	/** null — обзор всей страны. */
	const territory = $derived(
		activeId === ALL_TERRITORIES ? null : (data.territories.find((t) => t.id === activeId) ?? null)
	);
	const overview = $derived(territory === null);

	let selectedId = $state<string | null>(null);
	let sheetSnap = $state<'peek' | 'half' | 'full'>('half');
	let drawing = $state(false);
	let kind = $state<ReportKind>('trash');
	let draftPoint = $state<[number, number] | null>(null);
	let draftArea = $state<[number, number][]>([]);

	const visible = $derived(isStaff ? reports.items : reports.visibleTo(authorName));
	const inTerritory = $derived(
		overview ? visible : visible.filter((r) => r.territoryId === territory!.id)
	);

	let filter = $state<'all' | ReportStatus>('all');
	const shown = $derived(
		filter === 'all' ? inTerritory : inTerritory.filter((r) => r.status === filter)
	);

	const health = $derived(
		overview
			? {
					open: inTerritory.filter((r) => r.status !== 'rejected').length,
					mood: overallMood(visible)
				}
			: territoryHealth(visible, territory!.id)
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
		if (kind === 'trash') draftPoint = coordinates;
		else draftArea = [...draftArea, coordinates];
	}

	function undo() {
		if (kind === 'trash') draftPoint = null;
		else draftArea = draftArea.slice(0, -1);
	}

	function startDrawing() {
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

	function submit({ title, note, photo }: { title: string; note: string; photo: File | null }) {
		const territoryId = territory?.id ?? data.territories[0].id;

		if (kind === 'trash') {
			// Реальная отправка — через офлайн-очередь (см. offlineQueue.svelte.ts):
			// она сама решает, слать ли сейчас или ждать связи, и сама зеркалит
			// результат в этот же мок-стор, поэтому здесь `reports.add` не нужен.
			const [lon, lat] = draftPoint!;
			offlineQueue.enqueue(
				{ lat, lon, description: note || title, title, territoryId, authorName },
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

	function selectTerritory(id: string) {
		picked = id;
		sheetSnap = 'half';
	}

	// Рисовать точку в обзоре страны нельзя: непонятно, к какой территории её
	// отнести, да и попасть пальцем в берег на таком масштабе невозможно.
	const canDraw = $derived(!isStaff && !overview);
</script>

<svelte:head><title>Карта · Чистый берег</title></svelte:head>

<div class="absolute inset-0">
	<PollutionMap
		items={shown}
		territories={data.territories}
		activeTerritory={territory}
		{selectedId}
		onselect={(id) => (selectedId = id)}
		{route}
		drawMode={drawing ? (kind === 'trash' ? 'point' : 'area') : 'off'}
		draft={kind === 'trash' ? (draftPoint ? [draftPoint] : []) : draftArea}
		onmapclick={mapClick}
		onterritory={selectTerritory}
		{parcels}
	/>
</div>

<BottomSheet bind:snap={sheetSnap} label={drawing ? 'Новая гипотеза' : 'Точки загрязнения'}>
	{#snippet header()}
		{#if !drawing}
			<div class="flex flex-col gap-3 border-b border-slate-200 px-4 pb-4 md:pt-4">
				<div class="flex items-start gap-3">
					<Logo mood={health.mood} size={36} />
					<div class="min-w-0 flex-1">
						<h1 class="truncate text-base font-semibold text-slate-900">
							{territory?.name ?? 'Вся Россия'}
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

				<TerritoryPicker
					territories={data.territories}
					value={activeId}
					onchange={selectTerritory}
					locked={isStaff}
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
