<script lang="ts">
	import { CalendarDays, CircleCheck, MapPin, TriangleAlert, Users } from '@lucide/svelte';
	import { ApiError } from '$lib/api/client';
	import { events, type CleanupEvent } from '$lib/api/endpoints';
	import { formatDate } from '$lib/format';

	/**
	 * Мероприятия глазами волонтёра.
	 *
	 * Ручки `POST/DELETE /events/{id}/join` были на бэкенде, но во фронте
	 * записи не существовало: кнопка «Записаться» в карточке точки увеличивала
	 * локальный счётчик и ничего не отправляла. Человек «записывался», ООПТ об
	 * этом не знала, и на уборку никто не приезжал.
	 *
	 * Ограничение доступа проверяет бэкенд (обучение и согласие представителя),
	 * поэтому здесь мы не гадаем, а показываем его ответ как есть.
	 */

	let items = $state<CleanupEvent[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let busyId = $state<string | null>(null);
	let note = $state<string | null>(null);

	async function load() {
		loading = true;
		error = null;
		try {
			const res = await events.list();
			items = res.items;
		} catch (cause) {
			error = cause instanceof ApiError ? cause.message : 'Не удалось загрузить мероприятия';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	async function toggle(event: CleanupEvent) {
		if (busyId) return;
		busyId = event.id;
		error = null;
		note = null;
		try {
			if (event.is_joined) {
				await events.leave(event.id);
				note = 'Запись отменена.';
			} else {
				const res = await events.join(event.id);
				note = res.already_joined ? 'Вы уже были записаны.' : 'Вы записаны на уборку.';
			}
			await load();
		} catch (cause) {
			error = cause instanceof ApiError ? cause.message : 'Не удалось изменить запись';
		} finally {
			busyId = null;
		}
	}
</script>

<svelte:head><title>Мероприятия · Чистый берег</title></svelte:head>

<div class="h-full overflow-y-auto">
	<div class="mx-auto flex max-w-2xl flex-col gap-5 p-4 pb-16 sm:p-6">
		<header>
			<h1 class="text-xl font-semibold text-slate-900">Уборки</h1>
			<p class="mt-1 text-sm text-slate-500">
				Выезды, которые запланировали ООПТ по подтверждённым точкам. Запись видит организатор.
			</p>
		</header>

		{#if loading}
			<p class="text-sm text-slate-500">Загружаем…</p>
		{:else if error}
			<div class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
				<TriangleAlert size={16} class="mt-0.5 shrink-0 text-red-500" />
				<div>
					<p class="text-red-800">{error}</p>
					<button type="button" onclick={load} class="mt-2 font-medium text-red-900 underline">
						Попробовать снова
					</button>
				</div>
			</div>
		{:else if items.length === 0}
			<p class="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
				Пока ни одной запланированной уборки. Они появляются, когда ООПТ подтверждает точку и
				назначает выезд — мы пришлём уведомление.
			</p>
		{:else}
			{#if note}
				<p class="flex items-center gap-1.5 text-sm text-emerald-700">
					<CircleCheck size={15} />{note}
				</p>
			{/if}

			<ul class="flex flex-col gap-3">
				{#each items as event (event.id)}
					<li class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
						<div>
							<p class="text-sm font-medium text-slate-900">{event.title}</p>
							{#if event.description}
								<p class="mt-0.5 text-sm text-slate-600">{event.description}</p>
							{/if}
						</div>

						<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
							{#if event.scheduled_at}
								<span class="flex items-center gap-1.5">
									<CalendarDays size={13} />{formatDate(event.scheduled_at)}
								</span>
							{/if}
							{#if event.place}
								<span class="flex items-center gap-1.5"><MapPin size={13} />{event.place}</span>
							{/if}
							<span class="flex items-center gap-1.5">
								<Users size={13} />{event.participants_count} записались
							</span>
						</div>

						<button
							type="button"
							onclick={() => toggle(event)}
							disabled={busyId === event.id || event.status !== 'planned'}
							class="min-h-11 rounded-full px-4 text-sm font-medium disabled:opacity-60 {event.is_joined
								? 'border border-slate-300 text-slate-900 hover:bg-slate-50'
								: 'bg-slate-900 text-white hover:bg-slate-700'}"
						>
							{#if event.status !== 'planned'}
								Запись закрыта
							{:else if busyId === event.id}
								Секунду…
							{:else if event.is_joined}
								Отменить запись
							{:else}
								Записаться
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
