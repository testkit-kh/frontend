<script lang="ts">
	import { ApiError } from '$lib/api/client';
	import { events, type CleanupEvent, type Schemas } from '$lib/api/endpoints';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { formatDate } from '$lib/format';

	const STATUS_LABEL: Record<Schemas['EventStatus'], string> = {
		planned: 'Запланировано',
		in_progress: 'Идёт',
		completed: 'Завершено',
		cancelled: 'Отменено'
	};

	let items = $state<CleanupEvent[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedId = $state<string | null>(null);
	let busy = $state(false);

	// Форма редактирования (планирование выезда)
	let place = $state('');
	let scheduledAt = $state('');
	let description = $state('');

	// Форма закрытия мероприятия
	let actualParticipants = $state(0);
	let wasteVolume = $state<number | null>(null);
	let wasteMass = $state<number | null>(null);
	let resultNotes = $state('');

	async function load() {
		loading = true;
		error = null;
		try {
			const res = await events.list();
			items = res.items;
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось загрузить мероприятия';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	const current = $derived(items.find((e) => e.id === selectedId) ?? null);

	let lastCurrent: string | null = null;
	$effect(() => {
		const id = current?.id ?? null;
		if (lastCurrent === id) return;
		lastCurrent = id;
		place = current?.place ?? '';
		scheduledAt = current?.scheduled_at?.slice(0, 16) ?? '';
		description = current?.description ?? '';
		actualParticipants = current?.participants_count ?? 0;
		wasteVolume = null;
		wasteMass = null;
		resultNotes = '';
	});

	async function saveSchedule() {
		if (!current || busy) return;
		busy = true;
		error = null;
		try {
			const updated = await events.update(current.id, {
				place: place.trim() || undefined,
				description: description.trim() || undefined,
				scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined
			});
			items = items.map((e) => (e.id === updated.id ? updated : e));
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось сохранить';
		} finally {
			busy = false;
		}
	}

	async function complete() {
		if (!current || busy) return;
		busy = true;
		error = null;
		try {
			const res = await events.complete(current.id, {
				actual_participants: actualParticipants,
				waste_volume_m3: wasteVolume ?? undefined,
				waste_mass_kg: wasteMass ?? undefined,
				result_notes: resultNotes.trim() || undefined
			});
			items = items.map((e) => (e.id === res.event.id ? res.event : e));
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось закрыть мероприятие';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Мероприятия · Кабинет ООПТ</title></svelte:head>

<div class="flex h-full flex-col sm:flex-row">
	<aside class="flex w-full shrink-0 flex-col border-slate-200 bg-white sm:w-80 sm:border-r">
		<header class="border-b border-slate-200 p-4">
			<h2 class="text-base font-semibold text-slate-900">Мероприятия</h2>
			<p class="mt-1 text-xs text-slate-500">{items.length} всего</p>
		</header>
		{#if loading}
			<p class="p-4 text-sm text-slate-500">Загружаем…</p>
		{:else if items.length === 0}
			<p class="p-4 text-sm text-slate-500">
				Мероприятия появляются автоматически при подтверждении точки.
			</p>
		{:else}
			<ul class="divide-y divide-slate-200 overflow-y-auto">
				{#each items as item (item.id)}
					<li>
						<button
							type="button"
							onclick={() => (selectedId = item.id)}
							aria-current={item.id === selectedId ? 'true' : undefined}
							class="flex w-full flex-col gap-1 p-4 text-left hover:bg-slate-50 aria-[current]:bg-slate-50"
						>
							<span class="truncate text-sm font-medium text-slate-900">{item.title}</span>
							<span class="text-xs text-slate-500">
								{item.scheduled_at ? formatDate(item.scheduled_at) : 'дата не назначена'} ·
								{item.participants_count} записалось
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</aside>

	<div class="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
		{#if error}
			<p class="mb-4 text-sm text-red-700">{error}</p>
		{/if}

		{#if !current}
			<p class="text-sm text-slate-500">Выберите мероприятие слева.</p>
		{:else}
			<div class="flex flex-col gap-6">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h2 class="text-lg font-semibold text-slate-900">{current.title}</h2>
						<p class="mt-1 text-xs text-slate-500">
							{current.participants_count} записалось
							{#if current.actual_participants !== null}
								· {current.actual_participants} пришло
							{/if}
						</p>
					</div>
					<StatusPill
						label={STATUS_LABEL[current.status]}
						tone={current.status === 'completed'
							? 'positive'
							: current.status === 'cancelled'
								? 'neutral'
								: 'warning'}
					/>
				</div>

				{#if current.status !== 'completed'}
					<div class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
						<h3 class="text-sm font-medium text-slate-700">Планирование выезда</h3>
						<label class="flex flex-col gap-1 text-xs text-slate-500">
							Место сбора
							<input
								bind:value={place}
								placeholder="Парковка у 3-го км"
								class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
							/>
						</label>
						<label class="flex flex-col gap-1 text-xs text-slate-500">
							Дата и время
							<input
								type="datetime-local"
								bind:value={scheduledAt}
								class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
							/>
						</label>
						<label class="flex flex-col gap-1 text-xs text-slate-500">
							Описание
							<textarea
								bind:value={description}
								rows="2"
								placeholder="Что делаем и что взять с собой"
								class="resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
							></textarea>
						</label>
						<button
							type="button"
							disabled={busy}
							onclick={saveSchedule}
							class="self-start rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
						>
							Сохранить
						</button>
					</div>

					<div class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
						<h3 class="text-sm font-medium text-slate-700">Закрыть мероприятие с итогами</h3>
						<label class="flex flex-col gap-1 text-xs text-slate-500">
							Фактически пришло человек
							<input
								type="number"
								min="0"
								bind:value={actualParticipants}
								class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
							/>
						</label>
						<div class="grid grid-cols-2 gap-3">
							<label class="flex flex-col gap-1 text-xs text-slate-500">
								Объём, м³
								<input
									type="number"
									min="0"
									step="0.1"
									bind:value={wasteVolume}
									class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
								/>
							</label>
							<label class="flex flex-col gap-1 text-xs text-slate-500">
								Масса, кг
								<input
									type="number"
									min="0"
									step="1"
									bind:value={wasteMass}
									class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
								/>
							</label>
						</div>
						<label class="flex flex-col gap-1 text-xs text-slate-500">
							Заметки
							<textarea
								bind:value={resultNotes}
								rows="2"
								class="resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
							></textarea>
						</label>
						<button
							type="button"
							disabled={busy}
							onclick={complete}
							class="self-start rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
						>
							Закрыть мероприятие
						</button>
					</div>
				{:else}
					<div class="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
						<p>Объём: {current.waste_volume_m3 ?? '—'} м³</p>
						<p>Масса: {current.waste_mass_kg ?? '—'} кг</p>
						{#if current.result_notes}<p class="mt-2">{current.result_notes}</p>{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
