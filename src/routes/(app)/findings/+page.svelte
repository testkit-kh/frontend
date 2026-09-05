<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Radar, TriangleAlert } from '@lucide/svelte';
	import { ApiError } from '$lib/api/client';
	import { ml, type MlFinding, type MlHealth, type MlScan } from '$lib/api/endpoints';
	import { formatDate } from '$lib/format';

	let scans = $state<MlScan[]>([]);
	let findings = $state<MlFinding[]>([]);
	let health = $state<MlHealth | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedScanId = $state<string | null>(null);

	const selectedScan = $derived(scans.find((s) => s.id === selectedScanId) ?? null);
	const shownFindings = $derived(
		selectedScanId ? findings.filter((f) => f.scan_id === selectedScanId) : findings
	);

	async function load() {
		loading = true;
		error = null;
		try {
			const [scanRes, findingRes, healthRes] = await Promise.all([
				ml.listScans({ limit: 50 }),
				ml.listFindings({ limit: 200 }),
				ml.health().catch(() => null)
			]);
			scans = scanRes.items;
			findings = findingRes.items;
			health = healthRes;
			if (!selectedScanId && scans[0]) selectedScanId = scans[0].id;
		} catch (cause) {
			error = cause instanceof ApiError ? cause.message : 'Не удалось загрузить находки ML';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	function goToMap(lat: number | null, lon: number | null) {
		if (lat == null || lon == null) {
			goto(resolve('/map'));
			return;
		}
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- query после resolve('/map')
		goto(`${resolve('/map')}?lat=${lat}&lon=${lon}`);
	}
</script>

<svelte:head><title>Находки ML · Чистый берег</title></svelte:head>

<div class="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 overflow-auto p-4 md:p-6">
	<header class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-xl font-semibold text-slate-900">Находки автодетекции</h1>
			<p class="mt-1 text-sm text-slate-500">
				Прогоны ML по подложке и объекты, попавшие в очередь валидации.
			</p>
		</div>
		{#if health}
			<p
				class="rounded-full px-3 py-1 text-xs font-medium {health.status === 'ok'
					? 'bg-emerald-50 text-emerald-800'
					: 'bg-amber-50 text-amber-900'}"
			>
				ML: {health.configured ? health.status : 'не настроен'}
				{#if health.backend}
					· {health.backend}{health.trained ? '' : ' (бейзлайн)'}
				{/if}
			</p>
		{/if}
	</header>

	{#if health && (!health.configured || health.status === 'unavailable')}
		<p class="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
			<TriangleAlert size={16} class="mt-0.5 shrink-0" />
			<span>
				{health.detail ??
					'ML-сервис недоступен. Сохранённые сканы можно смотреть; новые — после поднятия ml.{DOMAIN}.'}
			</span>
		</p>
	{/if}

	{#if loading}
		<p class="text-sm text-slate-500">Загрузка…</p>
	{:else if error}
		<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
	{:else if scans.length === 0}
		<div class="flex flex-col items-center gap-3 py-16 text-center text-slate-500">
			<Radar size={32} class="text-violet-400" />
			<p class="text-sm">Сканов пока нет.</p>
			<p class="max-w-md text-xs">
				Откройте карту, приблизьте участок берега и нажмите «Сканировать участок».
			</p>
			<a
				href={resolve('/map')}
				class="mt-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
			>
				К карте
			</a>
		</div>
	{:else}
		<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
			<section class="min-w-0">
				<h2 class="mb-2 text-sm font-semibold text-slate-800">Таймлайн сканов</h2>
				<ol class="relative space-y-0 border-l border-violet-200 pl-4">
					{#each scans as scan (scan.id)}
						<li class="relative pb-4">
							<span
								class="absolute top-1.5 -left-[1.3rem] h-2.5 w-2.5 rounded-full border-2 border-white bg-violet-600"
							></span>
							<button
								type="button"
								onclick={() => (selectedScanId = scan.id)}
								class="w-full rounded-lg border px-3 py-2 text-left text-sm transition {selectedScanId ===
								scan.id
									? 'border-violet-300 bg-violet-50'
									: 'border-slate-200 bg-white hover:border-slate-300'}"
							>
								<p class="font-medium text-slate-900">
									{formatDate(scan.created_at)}
								</p>
								<p class="mt-0.5 text-xs text-slate-500">
									{scan.summary?.count ?? scan.findings_count} объектов
									{#if scan.hypotheses_created}
										· {scan.hypotheses_created} в очередь
									{/if}
									{#if scan.candidates_suppressed}
										· подложка грубая
									{/if}
								</p>
								{#if scan.imagery?.too_coarse}
									<p class="mt-1 text-xs text-amber-700">too_coarse — кандидаты подавлены</p>
								{/if}
							</button>
						</li>
					{/each}
				</ol>
			</section>

			<section class="min-w-0">
				<div class="mb-2 flex items-center justify-between gap-2">
					<h2 class="text-sm font-semibold text-slate-800">
						Находки
						{#if selectedScan}
							· скан {selectedScan.id.slice(0, 8)}
						{/if}
					</h2>
					{#if selectedScanId}
						<button
							type="button"
							class="text-xs text-slate-500 underline"
							onclick={() => (selectedScanId = null)}
						>
							все
						</button>
					{/if}
				</div>

				{#if selectedScan?.fraud_flags?.length}
					<ul class="mb-3 space-y-1">
						{#each selectedScan.fraud_flags as flag (flag.code + flag.message)}
							<li class="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
								{flag.message}
							</li>
						{/each}
					</ul>
				{/if}

				{#if shownFindings.length === 0}
					<p class="text-sm text-slate-500">В этом скане объектов нет.</p>
				{:else}
					<ul class="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
						{#each shownFindings as finding (finding.id)}
							<li class="flex items-start justify-between gap-3 px-3 py-3">
								<div class="min-w-0">
									<p class="text-sm font-medium text-slate-900">
										{finding.label_ru ?? finding.dominant_category ?? 'Объект'}
									</p>
									<p class="mt-0.5 text-xs text-slate-500">
										{formatDate(finding.created_at)}
										{#if finding.confidence != null}
											· {(finding.confidence * 100).toFixed(0)}%
										{/if}
										{#if finding.estimated_volume_m3 != null}
											· ~{finding.estimated_volume_m3.toFixed(2)} м³
										{/if}
										{#if finding.hypothesis_id}
											· в очереди ООПТ
										{/if}
									</p>
								</div>
								<button
									type="button"
									class="shrink-0 text-xs font-medium text-violet-700 hover:underline"
									onclick={() => goToMap(finding.lat, finding.lon)}
								>
									На карте
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>
	{/if}
</div>
