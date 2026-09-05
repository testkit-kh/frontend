<script lang="ts">
	import { ApiError } from '$lib/api/client';
	import { analytics, type AnalyticsSummary } from '$lib/api/endpoints';
	import { formatMoney } from '$lib/format';
	import DashboardEmbed from '$lib/components/DashboardEmbed.svelte';

	let summary = $state<AnalyticsSummary | null>(null);
	let error = $state<string | null>(null);

	$effect(() => {
		analytics
			.summary()
			.then((res) => (summary = res))
			.catch((err) => {
				error = err instanceof ApiError ? err.message : 'Не удалось загрузить сводку';
			});
	});
</script>

<svelte:head><title>Обзор · Кабинет ООПТ</title></svelte:head>

<div class="flex flex-col gap-6 p-4 sm:p-6">
	<h2 class="text-lg font-semibold text-slate-900">Обзор</h2>

	{#if error}
		<p class="text-sm text-red-700">{error}</p>
	{:else if !summary}
		<p class="text-sm text-slate-500">Загружаем…</p>
	{:else}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			<div class="rounded-xl border border-slate-200 bg-white p-4">
				<p class="text-xs text-slate-500">На проверке</p>
				<p class="mt-1 text-2xl font-semibold text-amber-600">{summary.pending}</p>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-4">
				<p class="text-xs text-slate-500">Подтверждено</p>
				<p class="mt-1 text-2xl font-semibold text-emerald-600">{summary.approved}</p>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-4">
				<p class="text-xs text-slate-500">Объём мусора</p>
				<p class="mt-1 text-2xl font-semibold text-slate-900">
					{summary.confirmed_volume_m3} м³
				</p>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-4">
				<p class="text-xs text-slate-500">Смета на уборку</p>
				<p class="mt-1 text-2xl font-semibold text-slate-900">
					{formatMoney(summary.confirmed_cleanup_cost_rub)}
				</p>
			</div>
		</div>
	{/if}

	<div>
		<h3 class="mb-2 text-sm font-medium text-slate-700">Операционка территории</h3>
		<DashboardEmbed slug="oopt" />
	</div>
</div>
