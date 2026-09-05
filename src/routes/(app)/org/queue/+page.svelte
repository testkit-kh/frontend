<script lang="ts">
	import { Check, Inbox, Plane, X } from '@lucide/svelte';
	import { ApiError } from '$lib/api/client';
	import { hypotheses, satellite, type Hypothesis, type SatelliteScene } from '$lib/api/endpoints';
	import { TRASH_CATEGORY_LABEL } from '$lib/data/trash';
	import SatelliteView from '$lib/components/SatelliteView.svelte';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { formatCoords, formatDate, formatMoney } from '$lib/format';

	let items = $state<Hypothesis[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedId = $state<string | null>(null);
	let reason = $state('');
	let busy = $state(false);
	let notice = $state<string | null>(null);

	async function load() {
		loading = true;
		error = null;
		try {
			items = await hypotheses.pending();
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось загрузить очередь';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	const current = $derived(items.find((h) => h.id === selectedId) ?? items[0] ?? null);

	let lastCurrent: string | null = null;
	$effect(() => {
		const id = current?.id ?? null;
		if (lastCurrent === id) return;
		lastCurrent = id;
		reason = '';
	});

	// Сцены Sentinel-2 рядом с текущей точкой — для SatelliteView.
	// Модуль может быть не настроен (503) или сцены под этим участком ещё
	// нет (нужен refresh на карте) — тогда просто пустой список, без баннера
	// ошибки: SatelliteView в этом случае покажет базовую карту.
	let satelliteScenes = $state<SatelliteScene[]>([]);
	let lastSatelliteId: string | null = null;
	$effect(() => {
		const point = current;
		if (!point || lastSatelliteId === point.id) return;
		lastSatelliteId = point.id;
		satelliteScenes = [];
		satellite
			.listScenes({ lat: point.lat, lon: point.lon, radius_m: 5000, limit: 8 })
			.then((res) => {
				if (lastSatelliteId === point.id) satelliteScenes = res.items;
			})
			.catch(() => {});
	});

	async function decide(status: 'approved' | 'rejected' | 'drone_requested') {
		if (!current || busy) return;
		if (status === 'rejected' && !reason.trim()) {
			error = 'Укажите причину отказа — волонтёр увидит её в своей ленте.';
			return;
		}
		busy = true;
		error = null;
		notice = null;
		try {
			const res = await hypotheses.validate(current.id, status, reason.trim() || undefined);
			items = items.filter((h) => h.id !== current.id);
			selectedId = null;
			if (res.event_id) {
				notice = 'Точка подтверждена — создано мероприятие на вкладке «Мероприятия».';
			}
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось сохранить решение';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Точки на проверке · Кабинет ООПТ</title></svelte:head>

<div class="flex h-full flex-col sm:flex-row">
	<aside class="flex w-full shrink-0 flex-col border-slate-200 bg-white sm:w-80 sm:border-r">
		<header class="border-b border-slate-200 p-4">
			<h2 class="text-base font-semibold text-slate-900">Точки на проверке</h2>
			<p class="mt-1 text-xs text-slate-500">{items.length} в очереди</p>
		</header>
		{#if loading}
			<p class="p-4 text-sm text-slate-500">Загружаем…</p>
		{:else if items.length === 0}
			<p class="p-4 text-sm text-slate-500">Очередь пуста — всё разобрано.</p>
		{:else}
			<ul class="divide-y divide-slate-200 overflow-y-auto">
				{#each items as item (item.id)}
					<li>
						<button
							type="button"
							onclick={() => (selectedId = item.id)}
							aria-current={item.id === current?.id ? 'true' : undefined}
							class="flex w-full flex-col gap-1 p-4 text-left hover:bg-slate-50 aria-[current]:bg-slate-50"
						>
							<span class="truncate text-sm font-medium text-slate-900">{item.description}</span>
							<span class="text-xs text-slate-500"
								>{formatDate(item.created_at)} · {formatCoords([item.lon, item.lat])}</span
							>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</aside>

	<div class="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
		{#if notice}
			<p
				class="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
			>
				{notice}
			</p>
		{/if}

		{#if !loading && !current}
			<div class="flex h-full flex-col items-center justify-center gap-3 text-center">
				<Inbox size={32} class="text-slate-300" />
				<p class="text-sm text-slate-500">Очередь пуста. Новые точки появятся здесь.</p>
			</div>
		{:else if current}
			<div class="flex flex-col gap-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0 flex-1">
						<h2 class="text-lg font-semibold text-slate-900">{current.description}</h2>
						<p class="mt-1 text-xs text-slate-500">
							{formatDate(current.created_at)} · {formatCoords([current.lon, current.lat])}
						</p>
					</div>
					{#if current.dominant_category}
						<StatusPill
							label={TRASH_CATEGORY_LABEL[current.dominant_category] ?? current.dominant_category}
							tone="info"
						/>
					{/if}
				</div>

				<div class="grid gap-4 md:grid-cols-2">
					<div class="flex flex-col gap-1">
						<p class="text-xs font-medium text-slate-500">Фото с места</p>
						{#if current.photo_url}
							<img
								src={current.photo_url}
								alt="Фото волонтёра"
								class="aspect-4/3 w-full rounded-lg border border-slate-200 object-cover"
							/>
						{:else}
							<div
								class="flex aspect-4/3 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400"
							>
								Фото не приложено
							</div>
						{/if}
					</div>
					<div class="flex flex-col gap-1">
						<p class="text-xs font-medium text-slate-500">Спутниковый снимок, те же координаты</p>
						<div class="aspect-4/3">
							<SatelliteView
								id={current.id}
								geometry={{ type: 'Point', coordinates: [current.lon, current.lat] }}
								color="#f59e0b"
								scenes={satelliteScenes}
							/>
						</div>
					</div>
				</div>

				<div
					class="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2"
				>
					{#if current.estimated_volume_m3}
						<p><span class="text-slate-500">Объём:</span> {current.estimated_volume_m3} м³</p>
					{/if}
					{#if current.estimated_area_m2}
						<p><span class="text-slate-500">Площадь:</span> {current.estimated_area_m2} м²</p>
					{/if}
					{#if current.fraction}
						<p><span class="text-slate-500">Фракция:</span> {current.fraction}</p>
					{/if}
					{#if current.access_type}
						<p><span class="text-slate-500">Доступ:</span> {current.access_type}</p>
					{/if}
					{#if current.cleanup_cost_rub}
						<p class="font-medium text-slate-900 sm:col-span-2">
							Смета уборки: {formatMoney(current.cleanup_cost_rub)}
						</p>
					{/if}
				</div>

				<label class="flex flex-col gap-1 text-xs text-slate-500">
					Причина отказа (обязательна при отказе)
					<textarea
						bind:value={reason}
						rows="2"
						placeholder="Что не подтвердилось и что стоит исправить"
						class="resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
					></textarea>
					<span class="text-slate-400">Волонтёр увидит этот текст в своей ленте.</span>
				</label>

				{#if error}
					<p class="text-sm text-red-700">{error}</p>
				{/if}

				<div class="flex flex-wrap gap-3">
					<button
						type="button"
						disabled={busy}
						onclick={() => decide('approved')}
						class="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
					>
						<Check size={16} /> Подтвердить
					</button>
					<button
						type="button"
						disabled={busy}
						onclick={() => decide('drone_requested')}
						class="flex items-center gap-2 rounded-full border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-60"
					>
						<Plane size={16} /> Требуется облёт дроном
					</button>
					<button
						type="button"
						disabled={busy}
						onclick={() => decide('rejected')}
						class="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						<X size={16} /> Отклонить
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
