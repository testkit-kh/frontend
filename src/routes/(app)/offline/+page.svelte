<script lang="ts">
	import { Cloud, CloudOff, RefreshCw, Trash2, TriangleAlert } from '@lucide/svelte';
	import { formatCoords } from '$lib/format';
	import { offlineQueue } from '$lib/state/offlineQueue.svelte';
	import type { QueueEntry } from '$lib/offline/db';

	const items = $derived(offlineQueue.items);
	const pending = $derived(offlineQueue.pending.length);
	const failed = $derived(offlineQueue.failed.length);

	function statusLabel(entry: QueueEntry) {
		if (entry.status === 'syncing') return 'Отправляем…';
		if (entry.status === 'failed') return 'Ошибка';
		if (entry.status === 'queued') return 'Ждёт связи';
		return 'Отправлено';
	}
</script>

<svelte:head><title>Офлайн-очередь · Чистый берег</title></svelte:head>

<div class="h-full overflow-y-auto">
	<div class="mx-auto flex max-w-2xl flex-col gap-5 p-4 pb-16 sm:p-6">
		<header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<h1 class="text-xl font-semibold text-slate-900">Офлайн-очередь</h1>
				<p class="mt-1 text-sm text-slate-500">
					Точки, которые ещё не доехали до сервера. Без связи они копятся здесь и уходят сами, как
					только сеть появится.
				</p>
			</div>
			<button
				type="button"
				onclick={() => offlineQueue.syncAll()}
				disabled={offlineQueue.syncing || !offlineQueue.online || pending + failed === 0}
				class="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400"
			>
				<RefreshCw size={16} class={offlineQueue.syncing ? 'animate-spin' : ''} />
				{offlineQueue.syncing ? 'Отправляем…' : 'Отправить сейчас'}
			</button>
		</header>

		<div
			class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm {offlineQueue.online
				? 'border-emerald-200 bg-emerald-50 text-emerald-800'
				: 'border-amber-200 bg-amber-50 text-amber-900'}"
		>
			{#if offlineQueue.online}
				<Cloud size={16} /> Связь есть
			{:else}
				<CloudOff size={16} /> Нет связи — новые точки останутся в очереди
			{/if}
			<span class="text-xs opacity-80">
				· ждут: {pending} · ошибки: {failed}
			</span>
		</div>

		{#if items.length === 0}
			<p class="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
				Очередь пуста. Когда поставите точку без сети, она появится здесь.
			</p>
		{:else}
			<ul class="flex flex-col gap-3">
				{#each items as entry (entry.clientId)}
					<li class="rounded-lg border border-slate-200 bg-white p-4">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<p class="truncate text-sm font-medium text-slate-900">{entry.payload.title}</p>
								<p class="mt-0.5 text-xs text-slate-500">
									{formatCoords([entry.payload.lon, entry.payload.lat])} · {statusLabel(entry)}
									{#if entry.attempts > 0}
										· попыток: {entry.attempts}
									{/if}
								</p>
								{#if entry.lastError}
									<p class="mt-2 flex items-start gap-1.5 text-xs text-red-700">
										<TriangleAlert size={13} class="mt-0.5 shrink-0" />
										{entry.lastError}
									</p>
								{/if}
							</div>
							<div class="flex shrink-0 gap-1">
								{#if entry.status === 'failed'}
									<button
										type="button"
										onclick={() => offlineQueue.retry(entry.clientId)}
										disabled={offlineQueue.syncing || !offlineQueue.online}
										class="rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:text-slate-400"
									>
										Повторить
									</button>
								{/if}
								<button
									type="button"
									onclick={() => offlineQueue.discard(entry.clientId)}
									aria-label="Удалить из очереди"
									class="rounded-full p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
								>
									<Trash2 size={15} />
								</button>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
