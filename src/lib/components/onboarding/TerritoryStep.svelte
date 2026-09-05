<script lang="ts">
	import {
		CircleCheck,
		Clock,
		Loader2,
		MapPin,
		Search,
		TriangleAlert,
		TriangleAlert as Warn
	} from '@lucide/svelte';
	import { ApiError } from '$lib/api/client';
	import { parcels as parcelsApi, type CadastralParcel } from '$lib/api/endpoints';
	import {
		isCadastralNumber,
		searchProtectedAreas,
		SEARCH_DEBOUNCE_MS,
		type OsmPlace
	} from '$lib/osm';
	import { onboardingState } from '$lib/state/onboarding.svelte';

	/**
	 * Шаг «границы территории» для кабинета ООПТ.
	 *
	 * Основной путь — кадастровый номер: бэкенд сам тянет границы из ФГИС ЕГРН.
	 * Но этот путь ломается двумя способами, и оба встречаются регулярно:
	 * у части ООПТ кадастрового номера нет вовсе, а у части он есть, но ЕГРН
	 * по нему молчит или недоступен. Раньше в обоих случаях сотрудник упирался
	 * в поле, которое ему нечем заполнить.
	 *
	 * Отсюда фолбэк на OpenStreetMap. Он честно разный в двух случаях:
	 *  • участок уже заведён, но границ нет → найденный полигон уходит на
	 *    сервер через `PUT /parcels/{id}/geometry` — это настоящая, рабочая
	 *    запись, ручка для ручного ввода границ именно для этого и сделана;
	 *  • кадастра нет вообще → полигон уходит в
	 *    `PATCH /organizations/me/territory` (границы ООПТ без кадастра).
	 *
	 * Данные OSM — не выписка из ЕГРН, и в списке всегда помечены источником.
	 */

	let { oncomplete }: { oncomplete?: () => void } = $props();

	let items = $state<CadastralParcel[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let number = $state('');
	let busy = $state(false);

	const numberValid = $derived(number.trim() === '' || isCadastralNumber(number));
	/** Участки без границ — именно им помогает подбор по OSM. */
	const unresolved = $derived(items.filter((p) => p.status !== 'resolved'));

	async function load() {
		loading = true;
		error = null;
		try {
			items = await parcelsApi.list();
		} catch (cause) {
			error = cause instanceof ApiError ? cause.message : 'Не удалось загрузить участки';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	async function add() {
		if (!isCadastralNumber(number) || busy) return;
		busy = true;
		error = null;
		try {
			const parcel = await parcelsApi.add(number.trim());
			items = [...items, parcel];
			number = '';
		} catch (cause) {
			error = cause instanceof ApiError ? cause.message : 'Не удалось добавить участок';
		} finally {
			busy = false;
		}
	}

	// ── Фолбэк: поиск границ в OpenStreetMap ─────────────────────────────
	let osmOpen = $state(false);
	let query = $state('');
	let places = $state<OsmPlace[]>([]);
	let searching = $state(false);
	let osmError = $state<string | null>(null);
	let chosen = $state<OsmPlace | null>(null);
	let savedNote = $state<string | null>(null);
	let controller: AbortController | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;

	function scheduleSearch(value: string) {
		if (timer) clearTimeout(timer);
		controller?.abort();
		if (value.trim().length < 3) {
			places = [];
			return;
		}
		// Пауза обязательна: политика Nominatim — не чаще запроса в секунду,
		// поиск на каждое нажатие клавиши приведёт к бану по IP.
		timer = setTimeout(() => runSearch(value), SEARCH_DEBOUNCE_MS);
	}

	async function runSearch(value: string) {
		controller = new AbortController();
		searching = true;
		osmError = null;
		try {
			places = await searchProtectedAreas(value, controller.signal);
			if (places.length === 0) osmError = 'Ничего не нашлось. Попробуйте официальное название.';
		} catch (cause) {
			if ((cause as Error)?.name === 'AbortError') return;
			osmError = 'OSM недоступен — попробуйте позже или введите кадастровый номер.';
		} finally {
			searching = false;
		}
	}

	$effect(() => {
		scheduleSearch(query);
	});

	/** Записать найденную границу существующему участку — настоящий PUT. */
	async function applyToParcel(parcelId: string) {
		if (!chosen || busy) return;
		busy = true;
		error = null;
		try {
			const updated = await parcelsApi.setGeometry(parcelId, chosen.geometry as never, 'osm');
			items = items.map((p) => (p.id === parcelId ? updated : p));
			savedNote = `Границы записаны участку из OSM: ${chosen.name}.`;
			chosen = null;
		} catch (cause) {
			error = cause instanceof ApiError ? cause.message : 'Не удалось сохранить границы';
		} finally {
			busy = false;
		}
	}

	/** Кадастра нет: граница организации через PATCH …/territory. */
	async function saveAsDraft() {
		if (!chosen || busy) return;
		busy = true;
		error = null;
		try {
			await onboardingState.saveTerritory({
				source: 'osm',
				osm_id: chosen.id,
				name: chosen.name,
				geometry: chosen.geometry as never
			});
			const synced = onboardingState.territory?.sync === 'synced';
			savedNote = synced
				? `Граница «${chosen.name}» сохранена на сервере.`
				: `Граница «${chosen.name}» сохранена локально — отправим при следующей попытке.`;
			chosen = null;
		} catch (cause) {
			error = cause instanceof ApiError ? cause.message : 'Не удалось сохранить границы';
		} finally {
			busy = false;
		}
	}

	const STATUS_LABEL: Record<string, string> = {
		pending: 'Уточняем границы',
		resolved: 'Границы получены',
		failed: 'Границы не получены'
	};
</script>

<div class="flex flex-col gap-5">
	<header class="flex items-start gap-3">
		<MapPin size={22} class="mt-0.5 shrink-0 text-slate-400" />
		<div>
			<h2 class="text-lg font-semibold text-slate-900">Границы территории</h2>
			<p class="mt-1 text-sm text-slate-500">
				По ним карта показывает, какие точки ваши, и куда волонтёрам можно ставить наблюдения.
				Кадастровый номер — основной путь; если его нет, подберём границу по OpenStreetMap.
			</p>
		</div>
	</header>

	<div class="flex flex-col gap-2">
		<label class="flex flex-col gap-1 text-xs text-slate-500">
			Кадастровый номер
			<div class="flex gap-2">
				<input
					bind:value={number}
					placeholder="41:01:0000000:1"
					class="min-h-12 flex-1 rounded-lg border px-3 text-sm text-slate-900 {numberValid
						? 'border-slate-300'
						: 'border-amber-300'}"
				/>
				<button
					type="button"
					onclick={add}
					disabled={busy || !isCadastralNumber(number)}
					class="min-h-12 rounded-full bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400"
				>
					Добавить
				</button>
			</div>
			{#if !numberValid}
				<span class="text-amber-700">Формат: 41:01:0000000:1</span>
			{/if}
		</label>

		{#if loading}
			<p class="text-sm text-slate-500">Загружаем участки…</p>
		{:else if items.length}
			<ul class="flex flex-col gap-2">
				{#each items as parcel (parcel.id)}
					<li
						class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm"
					>
						<span class="font-medium text-slate-900">{parcel.cadastral_number}</span>
						<span class="flex items-center gap-1.5 text-xs text-slate-500">
							{#if parcel.status === 'resolved'}
								<CircleCheck size={14} class="text-emerald-600" />
							{:else if parcel.status === 'pending'}
								<Clock size={14} class="text-amber-500" />
							{:else}
								<Warn size={14} class="text-amber-600" />
							{/if}
							{STATUS_LABEL[parcel.status] ?? parcel.status}
						</span>
					</li>
				{/each}
			</ul>
		{/if}

		{#if error}
			<p class="flex items-start gap-1.5 text-xs text-red-700">
				<TriangleAlert size={13} class="mt-0.5 shrink-0" />{error}
			</p>
		{/if}
	</div>

	<!-- Фолбэк. Открывается по кнопке, а не сразу: кадастр остаётся основным
	     путём, и подменять его подбором по карте по умолчанию не стоит. -->
	<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
		{#if !osmOpen}
			<button
				type="button"
				onclick={() => (osmOpen = true)}
				class="flex items-center gap-2 text-sm font-medium text-slate-900 underline"
			>
				<Search size={15} />
				{unresolved.length
					? 'Границы не пришли из ЕГРН — подобрать по OpenStreetMap'
					: 'Кадастрового номера нет — подобрать границу по OpenStreetMap'}
			</button>
		{:else}
			<div class="flex flex-col gap-3">
				<label class="flex flex-col gap-1 text-xs text-slate-500">
					Название заповедника, парка или заказника
					<input
						bind:value={query}
						placeholder="Кроноцкий заповедник"
						class="min-h-12 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
					/>
					<span class="text-slate-400">
						Данные OpenStreetMap — не выписка из ЕГРН. Это ориентир для карты, а не документ о
						границах.
					</span>
				</label>

				{#if searching}
					<p class="flex items-center gap-1.5 text-xs text-slate-400">
						<Loader2 size={13} class="animate-spin" /> Ищем в OpenStreetMap…
					</p>
				{:else if osmError}
					<p class="text-xs text-amber-700">{osmError}</p>
				{/if}

				{#if places.length}
					<ul class="flex flex-col gap-2">
						{#each places as place (place.id)}
							<li>
								<button
									type="button"
									onclick={() => (chosen = place)}
									class="w-full rounded-lg border p-3 text-left text-sm {chosen?.id === place.id
										? 'border-slate-900 bg-white'
										: 'border-slate-200 bg-white hover:border-slate-400'}"
								>
									<span class="font-medium text-slate-900">{place.name}</span>
									<span class="ml-2 text-xs text-slate-500">{place.kind}</span>
									<span class="mt-0.5 block truncate text-xs text-slate-400">{place.address}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}

				{#if chosen}
					<div class="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
						<p class="text-sm text-slate-900">Выбрано: {chosen.name}</p>
						{#if unresolved.length}
							<p class="text-xs text-slate-500">Записать эту границу участку, у которого её нет:</p>
							<div class="flex flex-wrap gap-2">
								{#each unresolved as parcel (parcel.id)}
									<button
										type="button"
										onclick={() => applyToParcel(parcel.id)}
										disabled={busy}
										class="min-h-11 rounded-full border border-slate-300 px-4 text-sm text-slate-900 hover:bg-slate-50 disabled:text-slate-400"
									>
										{parcel.cadastral_number}
									</button>
								{/each}
							</div>
						{:else}
							<p class="text-xs text-slate-500">
								Кадастровых участков пока нет — сохраним границу организации напрямую (без
								кадастрового номера).
							</p>
							<button
								type="button"
								onclick={saveAsDraft}
								disabled={busy}
								class="min-h-11 self-start rounded-full bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400"
							>
								Сохранить границу
							</button>
						{/if}
					</div>
				{/if}

				{#if savedNote}
					<p class="flex items-start gap-1.5 text-xs text-emerald-700">
						<CircleCheck size={13} class="mt-0.5 shrink-0" />{savedNote}
					</p>
				{/if}
			</div>
		{/if}
	</div>

	<button
		type="button"
		onclick={() => oncomplete?.()}
		class="min-h-12 rounded-full bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-700"
	>
		Продолжить
	</button>
</div>
