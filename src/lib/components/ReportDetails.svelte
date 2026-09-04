<script lang="ts">
	import {
		CalendarPlus,
		Car,
		Check,
		MapPin,
		Navigation,
		Satellite,
		Users,
		X
	} from '@lucide/svelte';
	import StatusBadge from './StatusBadge.svelte';
	import { centroid } from '$lib/map/features';
	import { formatCoords, formatDate, plural } from '$lib/format';
	import { reports } from '$lib/state/reports.svelte';
	import { KIND_LABEL, type Report, type Role } from '$lib/types';

	let {
		report,
		role,
		routeShown = false,
		ontoggleroute,
		onclose
	}: {
		report: Report;
		role: Role;
		routeShown?: boolean;
		ontoggleroute?: () => void;
		onclose: () => void;
	} = $props();

	function duration(minutes: number) {
		if (minutes < 60) return `${minutes} мин`;
		const hours = Math.floor(minutes / 60);
		const rest = minutes % 60;
		return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
	}

	let joined = $state(false);
	let date = $state('');

	let lastReport = '';
	$effect(() => {
		if (lastReport === report.id) return;
		lastReport = report.id;
		joined = false;
		date = '';
	});
</script>

<article
	class="flex max-h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white"
>
	<header class="flex items-start gap-3 border-b border-slate-200 p-4">
		<div class="min-w-0 flex-1">
			<h2 class="text-base font-semibold text-slate-900">{report.title}</h2>
			<p class="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
				{#if report.source === 'satellite'}
					<Satellite size={13} /> Найдено на снимке
				{:else}
					<MapPin size={13} /> Найдено на месте
				{/if}
				· {KIND_LABEL[report.kind]}
			</p>
		</div>
		<button
			type="button"
			onclick={onclose}
			aria-label="Закрыть карточку"
			class="-mt-2 -mr-2 shrink-0 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
		>
			<X size={16} />
		</button>
	</header>

	<div class="flex flex-col gap-3 overflow-y-auto p-4">
		<StatusBadge status={report.status} />

		{#if report.place}
			<p class="flex items-start gap-2 text-sm text-slate-700">
				<MapPin size={16} class="mt-0.5 shrink-0 text-slate-400" />
				{report.place}
			</p>
		{/if}

		<p class="text-sm text-slate-700">{report.note}</p>

		{#if report.route}
			<div class="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
				<p class="flex items-start gap-2 text-sm text-slate-700">
					<Car size={16} class="mt-0.5 shrink-0 text-slate-400" />
					<span>
						От {report.route.from} — {report.route.km} км, около {duration(report.route.minutes)}
						<span class="mt-0.5 block text-xs text-slate-500">
							Маршрут условный: до места последние метры пешком.
						</span>
					</span>
				</p>
				<button
					type="button"
					onclick={() => ontoggleroute?.()}
					aria-pressed={routeShown}
					class="flex items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 aria-pressed:border-slate-900 aria-pressed:bg-slate-900 aria-pressed:text-white"
				>
					<Navigation size={16} />
					{routeShown ? 'Скрыть маршрут' : 'Показать маршрут'}
				</button>
			</div>
		{/if}

		{#if report.verdict}
			<p class="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
				<span class="block text-xs font-medium text-slate-500">Решение ООПТ</span>
				{report.verdict}
			</p>
		{/if}

		<dl class="flex flex-col gap-1 text-xs text-slate-500">
			<div class="flex justify-between gap-3">
				<dt>Автор</dt>
				<dd class="text-slate-700">{report.author}</dd>
			</div>
			<div class="flex justify-between gap-3">
				<dt>Добавлено</dt>
				<dd class="text-slate-700">{formatDate(report.createdAt)}</dd>
			</div>
			<div class="flex justify-between gap-3">
				<dt>Координаты</dt>
				<dd class="text-slate-700">{formatCoords(centroid(report))}</dd>
			</div>
		</dl>

		{#if report.event}
			<div class="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
				<div>
					<p class="text-sm font-medium text-emerald-900">
						Субботник {formatDate(report.event.date)}
					</p>
					<p class="mt-1 flex items-center gap-1.5 text-xs text-emerald-700">
						<Users size={13} />
						{report.event.signed}
						{plural(report.event.signed, 'участник', 'участника', 'участников')}
					</p>
				</div>
				{#if role === 'volunteer'}
					<button
						type="button"
						disabled={joined}
						onclick={() => {
							reports.join(report.id);
							joined = true;
						}}
						class="flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-200 disabled:text-emerald-700"
					>
						{#if joined}
							<Check size={16} /> Вы записаны
						{:else}
							Записаться на уборку
						{/if}
					</button>
				{/if}
			</div>
		{:else if role === 'staff' && report.status === 'confirmed'}
			<div class="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
				<label class="flex flex-col gap-1 text-xs text-slate-500">
					Дата субботника
					<input
						type="date"
						bind:value={date}
						class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
					/>
				</label>
				<button
					type="button"
					disabled={!date}
					onclick={() => reports.schedule(report.id, date)}
					class="flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400"
				>
					<CalendarPlus size={16} /> Объявить сбор
				</button>
			</div>
		{/if}
	</div>
</article>
