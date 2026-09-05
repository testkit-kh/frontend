<script lang="ts">
	import { ApiError } from '$lib/api/client';
	import {
		monitoring,
		type MonitoringSite,
		type SiteAccumulation,
		type SiteSurvey
	} from '$lib/api/endpoints';
	import { formatDate } from '$lib/format';

	let sites = $state<MonitoringSite[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedId = $state<string | null>(null);

	let name = $state('');
	let code = $state('');
	let establishedAt = $state('');
	let busy = $state(false);

	let surveys = $state<SiteSurvey[]>([]);
	let accumulation = $state<SiteAccumulation | null>(null);
	let surveysLoading = $state(false);

	// Форма нового замера
	let surveyedAt = $state('');
	let itemCount = $state<number | null>(null);
	let wasCleaned = $state(false);
	let notes = $state('');

	async function load() {
		loading = true;
		error = null;
		try {
			sites = await monitoring.list();
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось загрузить площадки';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	const current = $derived(sites.find((s) => s.id === selectedId) ?? null);

	$effect(() => {
		if (!current) {
			surveys = [];
			accumulation = null;
			return;
		}
		surveysLoading = true;
		Promise.all([monitoring.surveys(current.id), monitoring.accumulation(current.id)])
			.then(([s, a]) => {
				surveys = s;
				accumulation = a;
			})
			.catch((err) => {
				error = err instanceof ApiError ? err.message : 'Не удалось загрузить замеры';
			})
			.finally(() => {
				surveysLoading = false;
			});
	});

	async function createSite() {
		if (!name.trim() || !code.trim() || !establishedAt || busy) return;
		busy = true;
		error = null;
		try {
			const site = await monitoring.create({
				name: name.trim(),
				code: code.trim(),
				established_at: new Date(establishedAt).toISOString()
			});
			sites = [...sites, site];
			name = '';
			code = '';
			establishedAt = '';
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось создать площадку';
		} finally {
			busy = false;
		}
	}

	async function addSurvey() {
		if (!current || !surveyedAt || busy) return;
		busy = true;
		error = null;
		try {
			const survey = await monitoring.addSurvey(current.id, {
				surveyed_at: new Date(surveyedAt).toISOString(),
				item_count: itemCount ?? undefined,
				was_cleaned: wasCleaned,
				notes: notes.trim() || undefined
			});
			surveys = [...surveys, survey];
			accumulation = await monitoring.accumulation(current.id);
			surveyedAt = '';
			itemCount = null;
			wasCleaned = false;
			notes = '';
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось записать замер';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Площадки наблюдений · Кабинет ООПТ</title></svelte:head>

<div class="flex h-full flex-col sm:flex-row">
	<aside class="flex w-full shrink-0 flex-col border-slate-200 bg-white sm:w-80 sm:border-r">
		<header class="border-b border-slate-200 p-4">
			<h2 class="text-base font-semibold text-slate-900">Площадки наблюдений</h2>
		</header>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				createSite();
			}}
			class="flex flex-col gap-2 border-b border-slate-200 p-4"
		>
			<input
				bind:value={name}
				placeholder="Название площадки"
				class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
			/>
			<input
				bind:value={code}
				placeholder="Код, например KRO-01"
				class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
			/>
			<input
				type="date"
				bind:value={establishedAt}
				class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
			/>
			<button
				type="submit"
				disabled={busy}
				class="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
			>
				Заложить площадку
			</button>
		</form>

		{#if loading}
			<p class="p-4 text-sm text-slate-500">Загружаем…</p>
		{:else if sites.length === 0}
			<p class="p-4 text-sm text-slate-500">Площадок пока нет.</p>
		{:else}
			<ul class="divide-y divide-slate-200 overflow-y-auto">
				{#each sites as site (site.id)}
					<li>
						<button
							type="button"
							onclick={() => (selectedId = site.id)}
							aria-current={site.id === selectedId ? 'true' : undefined}
							class="flex w-full flex-col gap-1 p-4 text-left hover:bg-slate-50 aria-[current]:bg-slate-50"
						>
							<span class="text-sm font-medium text-slate-900">{site.name}</span>
							<span class="text-xs text-slate-500">
								{site.code} · {site.surveys_count}
								{site.surveys_count === 1 ? 'замер' : 'замеров'}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</aside>

	<div class="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
		{#if error}<p class="mb-4 text-sm text-red-700">{error}</p>{/if}

		{#if !current}
			<p class="text-sm text-slate-500">Выберите площадку слева.</p>
		{:else}
			<div class="flex flex-col gap-6">
				<div>
					<h2 class="text-lg font-semibold text-slate-900">{current.name}</h2>
					<p class="text-xs text-slate-500">
						Заложена {formatDate(current.established_at)}
						{#if current.shoreline_length_m}
							· берег {current.shoreline_length_m} м
						{/if}
					</p>
				</div>

				{#if accumulation && accumulation.mean_kg_per_day !== null}
					<div class="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
						<p class="font-medium text-slate-900">
							Скорость накопления: {accumulation.mean_kg_per_day.toFixed(1)} кг/день
						</p>
					</div>
				{/if}

				<div>
					<h3 class="mb-2 text-sm font-medium text-slate-700">Замеры</h3>
					{#if surveysLoading}
						<p class="text-sm text-slate-500">Загружаем…</p>
					{:else if surveys.length === 0}
						<p class="text-sm text-slate-500">Замеров пока не было.</p>
					{:else}
						<ul class="flex flex-col gap-2">
							{#each surveys as survey (survey.id)}
								<li class="rounded-lg border border-slate-200 bg-white p-3 text-sm">
									<p class="font-medium text-slate-900">{formatDate(survey.surveyed_at)}</p>
									<p class="text-xs text-slate-500">
										{survey.item_count ?? '—'} предметов ·
										{survey.computed_mass_kg ? `${survey.computed_mass_kg} кг` : 'масса не оценена'}
										{#if survey.was_cleaned}
											· убрано после замера{/if}
									</p>
									{#if survey.notes}<p class="mt-1 text-slate-600">{survey.notes}</p>{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<form
					onsubmit={(e) => {
						e.preventDefault();
						addSurvey();
					}}
					class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4"
				>
					<h3 class="text-sm font-medium text-slate-700">Новый замер</h3>
					<label class="flex flex-col gap-1 text-xs text-slate-500">
						Дата замера
						<input
							type="date"
							bind:value={surveyedAt}
							required
							class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
						/>
					</label>
					<label class="flex flex-col gap-1 text-xs text-slate-500">
						Число предметов
						<input
							type="number"
							min="0"
							bind:value={itemCount}
							class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
						/>
					</label>
					<label class="flex items-center gap-2 text-sm text-slate-700">
						<input type="checkbox" bind:checked={wasCleaned} />
						Мусор убрали сразу после замера
					</label>
					<label class="flex flex-col gap-1 text-xs text-slate-500">
						Заметки
						<textarea
							bind:value={notes}
							rows="2"
							class="resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
						></textarea>
					</label>
					<button
						type="submit"
						disabled={busy}
						class="self-start rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
					>
						Записать замер
					</button>
				</form>
			</div>
		{/if}
	</div>
</div>
