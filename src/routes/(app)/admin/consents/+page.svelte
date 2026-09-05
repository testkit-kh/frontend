<script lang="ts">
	import { Check, Inbox, X } from '@lucide/svelte';
	import { ApiError } from '$lib/api/client';
	import { consent, type ParentalConsent } from '$lib/api/endpoints';
	import { formatDate } from '$lib/format';

	let items = $state<ParentalConsent[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedId = $state<string | null>(null);
	let reason = $state('');
	let busy = $state(false);

	async function load() {
		loading = true;
		error = null;
		try {
			items = await consent.pending();
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось загрузить очередь';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	const current = $derived(items.find((i) => i.id === selectedId) ?? items[0] ?? null);

	let lastCurrent: string | null = null;
	$effect(() => {
		const id = current?.id ?? null;
		if (lastCurrent === id) return;
		lastCurrent = id;
		reason = '';
	});

	async function decide(approved: boolean) {
		if (!current || busy) return;
		if (!approved && !reason.trim()) {
			error = 'Укажите причину отказа.';
			return;
		}
		busy = true;
		error = null;
		try {
			await consent.review(current.id, { approved, reason: reason.trim() || undefined });
			items = items.filter((i) => i.id !== current.id);
			selectedId = null;
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось сохранить решение';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Согласия · Админ-панель</title></svelte:head>

<div class="flex h-full flex-col sm:flex-row">
	<aside class="flex w-full shrink-0 flex-col border-slate-200 bg-white sm:w-80 sm:border-r">
		<header class="border-b border-slate-200 p-4">
			<h2 class="text-base font-semibold text-slate-900">Согласия представителей</h2>
			<p class="mt-1 text-xs text-slate-500">{items.length} на проверке</p>
		</header>
		{#if loading}
			<p class="p-4 text-sm text-slate-500">Загружаем…</p>
		{:else if items.length === 0}
			<p class="p-4 text-sm text-slate-500">Очередь пуста.</p>
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
							<span class="truncate text-sm font-medium text-slate-900"
								>{item.representative_name}</span
							>
							<span class="text-xs text-slate-500">{formatDate(item.submitted_at)}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</aside>

	<div class="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
		{#if !loading && !current}
			<div class="flex h-full flex-col items-center justify-center gap-3 text-center">
				<Inbox size={32} class="text-slate-300" />
				<p class="text-sm text-slate-500">Очередь пуста.</p>
			</div>
		{:else if current}
			<div class="flex flex-col gap-4">
				<div>
					<h2 class="text-lg font-semibold text-slate-900">{current.representative_name}</h2>
					{#if current.relation}<p class="text-xs text-slate-500">{current.relation}</p>{/if}
				</div>

				<div class="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
					<p><span class="text-slate-500">Телефон:</span> {current.representative_phone}</p>
					<p><span class="text-slate-500">Email:</span> {current.representative_email}</p>
					<p><span class="text-slate-500">Подано:</span> {formatDate(current.submitted_at)}</p>
				</div>

				{#if current.scan_url}
					<!-- scan_url приходит с бэка, не роут приложения. -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={current.scan_url}
						target="_blank"
						rel="noreferrer"
						class="self-start rounded-full border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100"
					>
						Открыть скан согласия
					</a>
				{:else}
					<p class="text-sm text-slate-500">Скан не приложен.</p>
				{/if}

				<label class="flex flex-col gap-1 text-xs text-slate-500">
					Причина отказа (обязательна при отказе)
					<textarea
						bind:value={reason}
						rows="2"
						class="resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
					></textarea>
				</label>

				{#if error}<p class="text-sm text-red-700">{error}</p>{/if}

				<div class="flex flex-wrap gap-3">
					<button
						type="button"
						disabled={busy}
						onclick={() => decide(true)}
						class="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
					>
						<Check size={16} /> Принять
					</button>
					<button
						type="button"
						disabled={busy}
						onclick={() => decide(false)}
						class="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						<X size={16} /> Отклонить
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
