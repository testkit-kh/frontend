<script lang="ts">
	import { Check, Inbox, Plane, X } from '@lucide/svelte';
	import PhotoStub from '$lib/components/PhotoStub.svelte';
	import SatelliteView from '$lib/components/SatelliteView.svelte';
	import ReportList from '$lib/components/ReportList.svelte';
	import { formatCoords, formatDate } from '$lib/format';
	import { centroid } from '$lib/map/features';
	import { reports } from '$lib/state/reports.svelte';
	import { session } from '$lib/state/session.svelte';
	import { KIND_LABEL, type ReportStatus } from '$lib/types';

	let { data } = $props();

	const user = $derived(session.user!);

	const territory = $derived(
		data.territories.find((t) => t.id === user.organizationId) ?? data.territories[0]
	);

	let selectedId = $state<string | null>(null);
	let verdict = $state('');

	const queue = $derived(reports.pendingIn(territory.id));

	const current = $derived(queue.find((r) => r.id === selectedId) ?? queue[0] ?? null);

	let lastCurrent: string | null = null;
	$effect(() => {
		const id = current?.id ?? null;
		if (lastCurrent === id) return;
		lastCurrent = id;
		verdict = '';
	});

	function decide(status: ReportStatus, fallback: string) {
		if (!current) return;
		reports.decide(current.id, status, verdict.trim() || fallback);
		selectedId = null;
	}
</script>

<svelte:head><title>Предложка · Чистый берег</title></svelte:head>

<div class="flex h-full">
	<aside class="hidden w-80 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
		<header class="border-b border-slate-200 p-4">
			<h1 class="text-base font-semibold text-slate-900">Предложка</h1>
			<p class="mt-1 text-xs text-slate-500">
				{queue.length} на проверке · только точки внутри границ ООПТ «{territory.name}»
			</p>
		</header>
		<ReportList
			items={queue}
			selectedId={current?.id ?? null}
			onselect={(id) => (selectedId = id)}
			empty="Очередь пуста — всё разобрано."
		/>
	</aside>

	<div class="min-w-0 flex-1 overflow-y-auto p-4">
		{#if !current}
			<div class="flex h-full flex-col items-center justify-center gap-3 text-center">
				<Inbox size={32} class="text-slate-300" />
				<p class="text-sm text-slate-500">Очередь пуста. Новые гипотезы появятся здесь.</p>
			</div>
		{:else}
			<div class="flex flex-col gap-4">
				<div class="flex flex-wrap items-start gap-3">
					<div class="min-w-0 flex-1">
						<h2 class="text-lg font-semibold text-slate-900">{current.title}</h2>
						<p class="mt-1 text-xs text-slate-500">
							{KIND_LABEL[current.kind]} · {current.author} · {formatDate(current.createdAt)} ·
							{formatCoords(centroid(current))}
						</p>
					</div>
				</div>

				<p class="text-sm text-slate-700">{current.note}</p>

				<div class="grid gap-4 md:grid-cols-2">
					<div class="flex flex-col gap-1">
						<p class="text-xs font-medium text-slate-500">С места</p>
						<div class="aspect-4/3">
							<PhotoStub id={current.id} kind={current.kind} alt="Фото волонтёра" />
						</div>
					</div>
					<div class="flex flex-col gap-1">
						<p class="text-xs font-medium text-slate-500">Спутниковый снимок, те же координаты</p>
						<div class="aspect-4/3">
							<SatelliteView report={current} />
						</div>
					</div>
				</div>

				<label class="flex flex-col gap-1 text-xs text-slate-500">
					Комментарий к решению
					<textarea
						bind:value={verdict}
						rows="2"
						placeholder="Что видно на снимке, что решили и почему"
						class="resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
					></textarea>
					<span class="text-slate-400">Комментарий увидит волонтёр — это часть обучения.</span>
				</label>

				<div class="flex flex-wrap gap-3">
					<button
						type="button"
						onclick={() => decide('confirmed', 'Подтверждено сотрудником ООПТ.')}
						class="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
					>
						<Check size={16} /> Подтвердить
					</button>
					<button
						type="button"
						onclick={() => decide('drone', 'Снимка нет или он под облаками. Нужен облёт дроном.')}
						class="flex items-center gap-2 rounded-full border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100"
					>
						<Plane size={16} /> Требуется облёт дроном
					</button>
					<button
						type="button"
						onclick={() => decide('rejected', 'Загрязнение не подтвердилось.')}
						class="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
					>
						<X size={16} /> Отклонить
					</button>
				</div>

				{#if user.role !== 'staff'}
					<p class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
						Вы вошли волонтёром: в бою этот экран доступен только сотрудникам ООПТ. Здесь он открыт,
						чтобы оба контура можно было посмотреть с одной учётной записи.
					</p>
				{/if}
			</div>
		{/if}
	</div>
</div>
