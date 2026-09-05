<script lang="ts">
	import { Loader2, Search } from '@lucide/svelte';
	import { ApiError } from '$lib/api/client';
	import { parcels as parcelsApi, type CadastralParcel } from '$lib/api/endpoints';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { formatDate } from '$lib/format';
	import {
		isCadastralNumber,
		searchProtectedAreas,
		SEARCH_DEBOUNCE_MS,
		type OsmPlace
	} from '$lib/osm';

	const STATUS_LABEL = {
		pending: 'Уточняем границы',
		resolved: 'Границы получены',
		failed: 'Не удалось'
	};

	let items = $state<CadastralParcel[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let newNumber = $state('');
	let busy = $state(false);
	let geometryDrafts = $state<Record<string, string>>({});
	let checkResult = $state<string | null>(null);

	// OSM
	let osmQuery = $state('');
	let places = $state<OsmPlace[]>([]);
	let searching = $state(false);
	let osmError = $state<string | null>(null);
	let chosen = $state<OsmPlace | null>(null);
	let osmNote = $state<string | null>(null);
	let controller: AbortController | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;

	const unresolved = $derived(items.filter((p) => p.status !== 'resolved'));

	async function load() {
		loading = true;
		error = null;
		try {
			items = await parcelsApi.list();
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось загрузить участки';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	function scheduleSearch(value: string) {
		if (timer) clearTimeout(timer);
		controller?.abort();
		if (value.trim().length < 3) {
			places = [];
			return;
		}
		timer = setTimeout(() => runSearch(value), SEARCH_DEBOUNCE_MS);
	}

	async function runSearch(value: string) {
		controller = new AbortController();
		searching = true;
		osmError = null;
		try {
			places = await searchProtectedAreas(value, controller.signal);
			if (places.length === 0) osmError = 'Ничего не нашлось. Попробуйте официальное название.';
		} catch (cause) {
			if ((cause as Error)?.name === 'AbortError') return;
			osmError = 'OSM недоступен — попробуйте позже или введите кадастровый номер.';
		} finally {
			searching = false;
		}
	}

	$effect(() => {
		scheduleSearch(osmQuery);
	});

	async function add() {
		if (!newNumber.trim() || busy) return;
		if (!isCadastralNumber(newNumber)) {
			error = 'Формат кадастрового номера: 41:01:0000000:1';
			return;
		}
		busy = true;
		error = null;
		try {
			const parcel = await parcelsApi.add(newNumber.trim());
			items = [...items, parcel];
			newNumber = '';
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось добавить участок';
		} finally {
			busy = false;
		}
	}

	async function addFromOsm() {
		if (!chosen || busy) return;
		if (chosen.geometry.type !== 'Polygon' && chosen.geometry.type !== 'MultiPolygon') {
			error = 'У объекта нет площадной геометрии.';
			return;
		}
		busy = true;
		error = null;
		osmNote = null;
		try {
			const parcel = await parcelsApi.addFromOsm({
				osm_id: chosen.id,
				name: chosen.name,
				geometry: chosen.geometry
			});
			items = [...items, parcel];
			osmNote = `Участок добавлен из OSM: ${chosen.name} (${chosen.id}).`;
			chosen = null;
			osmQuery = '';
			places = [];
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось добавить участок из OSM';
		} finally {
			busy = false;
		}
	}

	async function applyOsmToParcel(parcelId: string) {
		if (!chosen || busy) return;
		busy = true;
		error = null;
		try {
			const updated = await parcelsApi.setGeometry(parcelId, chosen.geometry as never, 'osm');
			items = items.map((p) => (p.id === parcelId ? updated : p));
			osmNote = `Границы записаны участку из OSM: ${chosen.name}.`;
			chosen = null;
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось сохранить границы';
		} finally {
			busy = false;
		}
	}

	async function retry(id: string) {
		busy = true;
		error = null;
		try {
			const updated = await parcelsApi.retry(id);
			items = items.map((p) => (p.id === id ? updated : p));
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось повторить резолвинг';
		} finally {
			busy = false;
		}
	}

	async function setGeometry(id: string) {
		const raw = geometryDrafts[id];
		if (!raw?.trim() || busy) return;
		busy = true;
		error = null;
		try {
			const geometry = JSON.parse(raw);
			const updated = await parcelsApi.setGeometry(id, geometry);
			items = items.map((p) => (p.id === id ? updated : p));
			geometryDrafts = { ...geometryDrafts, [id]: '' };
		} catch (err) {
			error =
				err instanceof ApiError
					? err.message
					: err instanceof SyntaxError
						? 'Это не валидный JSON — вставьте GeoJSON-геометрию (type + coordinates)'
						: 'Не удалось сохранить границы';
		} finally {
			busy = false;
		}
	}

	async function remove(id: string) {
		busy = true;
		error = null;
		try {
			await parcelsApi.remove(id);
			items = items.filter((p) => p.id !== id);
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось удалить участок';
		} finally {
			busy = false;
		}
	}

	async function check() {
		if (!newNumber.trim()) return;
		checkResult = 'Проверяем…';
		try {
			const res = await parcelsApi.resolveCheck(newNumber.trim());
			checkResult =
				res.outcome === 'ok'
					? `ФГИС доступен: ${res.vertices} вершин за ${res.elapsed_seconds} с`
					: (res.detail ?? res.outcome);
		} catch (err) {
			checkResult = err instanceof ApiError ? err.message : 'Проверка не удалась';
		}
	}

	function sourceLabel(source: string | null) {
		if (source === 'osm') return 'OpenStreetMap';
		if (source === 'manual') return 'границы вручную';
		if (source === 'rosreestr' || source === 'egrn') return 'Росреестр';
		return source ?? 'источник неизвестен';
	}

	function displayNumber(parcel: CadastralParcel) {
		if (parcel.cadastral_number.startsWith('OSM:')) {
			return parcel.cadastral_number.slice(4);
		}
		return parcel.cadastral_number;
	}
</script>

<svelte:head><title>Кадастровые участки · Кабинет ООПТ</title></svelte:head>

<div class="flex flex-col gap-6 p-4 sm:p-6">
	<h2 class="text-lg font-semibold text-slate-900">Кадастровые участки</h2>

	<div class="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
		<label class="flex flex-col gap-1 text-xs text-slate-500">
			Кадастровый номер
			<input
				bind:value={newNumber}
				placeholder="41:01:0000000:1"
				class="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
			/>
		</label>
		<button
			type="button"
			disabled={busy}
			onclick={add}
			class="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
		>
			Добавить
		</button>
		<button
			type="button"
			onclick={check}
			class="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
		>
			Проверить доступность ФГИС
		</button>
		{#if checkResult}<p class="w-full text-xs text-slate-500">{checkResult}</p>{/if}
	</div>

	<div class="flex flex-col gap-3 rounded-lg border border-violet-100 bg-violet-50/40 p-4">
		<h3 class="text-sm font-medium text-slate-800">Или найти границы в OpenStreetMap</h3>
		<p class="text-xs text-slate-500">
			Когда кадастра нет или ФГИС молчит. Данные OSM — не выписка из ЕГРН; участок помечается
			источником osm.
		</p>
		<label class="relative flex flex-col gap-1 text-xs text-slate-500">
			Название ООПТ / заказника
			<span class="relative">
				<Search
					size={14}
					class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
				/>
				<input
					bind:value={osmQuery}
					placeholder="Кроноцкий заповедник"
					class="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-sm text-slate-900"
				/>
				{#if searching}
					<Loader2
						size={14}
						class="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-slate-400"
					/>
				{/if}
			</span>
		</label>
		{#if osmError}<p class="text-xs text-amber-800">{osmError}</p>{/if}
		{#if places.length > 0}
			<ul
				class="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white"
			>
				{#each places as place (place.id)}
					<li>
						<button
							type="button"
							onclick={() => (chosen = place)}
							class="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-slate-50 {chosen?.id ===
							place.id
								? 'bg-violet-50'
								: ''}"
						>
							<span class="text-sm font-medium text-slate-900">{place.name}</span>
							<span class="truncate text-xs text-slate-500"
								>{place.kind} · {place.id} · {place.address}</span
							>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		{#if chosen}
			<div class="flex flex-wrap items-center gap-2">
				<p class="text-xs text-slate-600">
					Выбрано: <span class="font-medium">{chosen.name}</span> ({chosen.id})
				</p>
				<button
					type="button"
					disabled={busy}
					onclick={addFromOsm}
					class="rounded-full bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-600 disabled:opacity-60"
				>
					Добавить как участок
				</button>
				{#if unresolved.length > 0}
					<span class="text-xs text-slate-400">или применить к существующему:</span>
					{#each unresolved as parcel (parcel.id)}
						<button
							type="button"
							disabled={busy}
							onclick={() => applyOsmToParcel(parcel.id)}
							class="rounded-full border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-white disabled:opacity-60"
						>
							→ {displayNumber(parcel)}
						</button>
					{/each}
				{/if}
			</div>
		{/if}
		{#if osmNote}<p class="text-xs text-emerald-800">{osmNote}</p>{/if}
	</div>

	{#if error}<p class="text-sm text-red-700">{error}</p>{/if}

	{#if loading}
		<p class="text-sm text-slate-500">Загружаем…</p>
	{:else if items.length === 0}
		<p class="text-sm text-slate-500">Участков пока нет.</p>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each items as parcel (parcel.id)}
				<li class="rounded-lg border border-slate-200 bg-white p-4">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div>
							<p class="font-medium text-slate-900">{displayNumber(parcel)}</p>
							<p class="text-xs text-slate-500">
								{parcel.area_ha ? `${parcel.area_ha.toFixed(1)} га` : 'площадь неизвестна'} ·
								{sourceLabel(parcel.source)} ·
								{formatDate(parcel.created_at)}
							</p>
						</div>
						<div class="flex items-center gap-2">
							<StatusPill
								label={STATUS_LABEL[parcel.status]}
								tone={parcel.status === 'resolved'
									? 'positive'
									: parcel.status === 'failed'
										? 'negative'
										: 'warning'}
							/>
							{#if parcel.status === 'failed' && !parcel.cadastral_number.startsWith('OSM:')}
								<button
									type="button"
									onclick={() => retry(parcel.id)}
									class="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
								>
									Повторить
								</button>
							{/if}
							<button
								type="button"
								onclick={() => remove(parcel.id)}
								class="rounded-full border border-red-200 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
							>
								Удалить
							</button>
						</div>
					</div>

					{#if parcel.status === 'failed'}
						<div class="mt-3 flex flex-col gap-2">
							{#if parcel.resolve_error}
								<p class="text-xs text-red-700">{parcel.resolve_error}</p>
							{/if}
							<label class="flex flex-col gap-1 text-xs text-slate-500">
								Границы вручную (GeoJSON-геометрия)
								<textarea
									value={geometryDrafts[parcel.id] ?? ''}
									oninput={(e) =>
										(geometryDrafts = {
											...geometryDrafts,
											[parcel.id]: e.currentTarget.value
										})}
									rows="3"
									placeholder={'{"type":"Polygon","coordinates":[[[...]]]}'}
									class="resize-none rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900"
								></textarea>
							</label>
							<button
								type="button"
								disabled={busy}
								onclick={() => setGeometry(parcel.id)}
								class="self-start rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-60"
							>
								Сохранить границы
							</button>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
