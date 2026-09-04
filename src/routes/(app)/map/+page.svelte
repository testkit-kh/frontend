<script lang="ts">
	import { List, Plus, X } from '@lucide/svelte';
	import PollutionMap from '$lib/map/PollutionMap.svelte';
	import ReportList from '$lib/components/ReportList.svelte';
	import ReportDetails from '$lib/components/ReportDetails.svelte';
	import NewReportForm from '$lib/components/NewReportForm.svelte';
	import MapLegend from '$lib/components/MapLegend.svelte';
	import TerritoryPicker from '$lib/components/TerritoryPicker.svelte';
	import { reports } from '$lib/state/reports.svelte';
	import { session } from '$lib/state/session.svelte';
	import type { ReportKind, ReportStatus } from '$lib/types';

	let { data } = $props();

	const user = $derived(session.user!);
	const isStaff = $derived(user.role === 'staff');

	let picked = $state<string | null>(null);
	const territory = $derived(
		data.territories.find((t) => t.id === (picked ?? user.organizationId)) ?? data.territories[0]
	);

	let selectedId = $state<string | null>(null);
	let panelOpen = $state(true);
	let drawing = $state(false);
	let kind = $state<ReportKind>('trash');
	let draftPoint = $state<[number, number] | null>(null);
	let draftArea = $state<[number, number][]>([]);

	const inTerritory = $derived(
		(isStaff ? reports.items : reports.visibleTo(user.name)).filter(
			(r) => r.territoryId === territory.id
		)
	);

	let filter = $state<'all' | ReportStatus>('all');
	const shown = $derived(
		filter === 'all' ? inTerritory : inTerritory.filter((r) => r.status === filter)
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
		if (lastTerritory === territory.id) return;
		lastTerritory = territory.id;
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
		panelOpen = true;
		selectedId = null;
	}

	function cancelDrawing() {
		drawing = false;
		draftPoint = null;
		draftArea = [];
	}

	function submit({ title, note }: { title: string; note: string }) {
		const report = reports.add({
			territoryId: territory.id,
			kind,
			source: kind === 'trash' ? 'field' : 'satellite',
			title,
			note,
			author: user.name,
			geometry:
				kind === 'trash'
					? { type: 'Point', coordinates: draftPoint! }
					: { type: 'Polygon', coordinates: [[...draftArea, draftArea[0]]] }
		});
		cancelDrawing();
		selectedId = report.id;
	}
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
	/>
</div>

{#if panelOpen}
	<aside
		class="absolute inset-y-4 left-4 z-10 flex w-80 max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white"
		aria-label={drawing ? 'Новая гипотеза' : 'Точки загрязнения'}
	>
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
		{:else}
			<header class="flex flex-col gap-3 border-b border-slate-200 p-4">
				<div class="flex items-start gap-3">
					<div class="min-w-0 flex-1">
						<h1 class="text-base font-semibold text-slate-900">{territory.name}</h1>
						<p class="mt-1 text-xs text-slate-500">
							{shown.length} из {inTerritory.length} точек в границах ООПТ
						</p>
					</div>
					<button
						type="button"
						onclick={() => (panelOpen = false)}
						aria-label="Скрыть список"
						class="-mt-2 -mr-2 shrink-0 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
					>
						<X size={16} />
					</button>
				</div>

				<TerritoryPicker
					territories={data.territories}
					value={territory.id}
					onchange={(id) => (picked = id)}
					locked={isStaff}
				/>

				<div class="flex gap-1 rounded-full bg-slate-100 p-1 text-xs">
					{#each FILTERS as option (option.value)}
						<button
							type="button"
							aria-pressed={filter === option.value}
							onclick={() => (filter = option.value)}
							class="flex-1 rounded-full px-3 py-1.5 text-slate-600 aria-pressed:bg-white aria-pressed:font-medium aria-pressed:text-slate-900"
						>
							{option.label}
						</button>
					{/each}
				</div>
			</header>

			<ReportList
				items={shown}
				{selectedId}
				onselect={(id) => (selectedId = id)}
				empty="В этом фильтре точек нет."
			/>

			{#if !isStaff}
				<div class="mt-auto border-t border-slate-200 p-4">
					<button
						type="button"
						onclick={startDrawing}
						class="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
					>
						<Plus size={16} /> Сообщить о загрязнении
					</button>
				</div>
			{/if}
		{/if}
	</aside>
{:else}
	<button
		type="button"
		onclick={() => (panelOpen = true)}
		class="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
	>
		<List size={16} /> Точки
	</button>
{/if}

<div class="pointer-events-none absolute inset-x-4 bottom-4 z-0 flex justify-center">
	<div class="pointer-events-auto hidden md:block">
		<MapLegend statuses={legend} />
	</div>
</div>

{#if selected}
	<div
		class="absolute inset-x-4 bottom-4 z-10 max-h-[70%] md:inset-x-auto md:top-4 md:right-4 md:bottom-4 md:w-96"
	>
		<ReportDetails
			report={selected}
			role={user.role}
			{routeShown}
			ontoggleroute={() => (routeShown = !routeShown)}
			onclose={() => (selectedId = null)}
		/>
	</div>
{/if}
