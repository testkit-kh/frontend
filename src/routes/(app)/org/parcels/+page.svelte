<script lang="ts">
	import { ApiError } from '$lib/api/client';
	import { parcels as parcelsApi, type CadastralParcel } from '$lib/api/endpoints';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { formatDate } from '$lib/format';

	const STATUS_LABEL = {
		pending: 'Уточняем границы',
		resolved: 'Границы получены',
		failed: 'Не удалось'
	};

	let items = $state<CadastralParcel[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let newNumber = $state('');
	let busy = $state(false);
	let geometryDrafts = $state<Record<string, string>>({});
	let checkResult = $state<string | null>(null);

	async function load() {
		loading = true;
		error = null;
		try {
			items = await parcelsApi.list();
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось загрузить участки';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	async function add() {
		if (!newNumber.trim() || busy) return;
		busy = true;
		error = null;
		try {
			const parcel = await parcelsApi.add(newNumber.trim());
			items = [...items, parcel];
			newNumber = '';
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось добавить участок';
		} finally {
			busy = false;
		}
	}

	async function retry(id: string) {
		busy = true;
		error = null;
		try {
			const updated = await parcelsApi.retry(id);
			items = items.map((p) => (p.id === id ? updated : p));
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось повторить резолвинг';
		} finally {
			busy = false;
		}
	}

	async function setGeometry(id: string) {
		const raw = geometryDrafts[id];
		if (!raw?.trim() || busy) return;
		busy = true;
		error = null;
		try {
			const geometry = JSON.parse(raw);
			const updated = await parcelsApi.setGeometry(id, geometry);
			items = items.map((p) => (p.id === id ? updated : p));
			geometryDrafts = { ...geometryDrafts, [id]: '' };
		} catch (err) {
			error =
				err instanceof ApiError
					? err.message
					: err instanceof SyntaxError
						? 'Это не валидный JSON — вставьте GeoJSON-геометрию (type + coordinates)'
						: 'Не удалось сохранить границы';
		} finally {
			busy = false;
		}
	}

	async function remove(id: string) {
		busy = true;
		error = null;
		try {
			await parcelsApi.remove(id);
			items = items.filter((p) => p.id !== id);
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось удалить участок';
		} finally {
			busy = false;
		}
	}

	async function check() {
		if (!newNumber.trim()) return;
		checkResult = 'Проверяем…';
		try {
			const res = await parcelsApi.resolveCheck(newNumber.trim());
			checkResult =
				res.outcome === 'ok'
					? `ФГИС доступен: ${res.vertices} вершин за ${res.elapsed_seconds} с`
					: (res.detail ?? res.outcome);
		} catch (err) {
			checkResult = err instanceof ApiError ? err.message : 'Проверка не удалась';
		}
	}
</script>

<svelte:head><title>Кадастровые участки · Кабинет ООПТ</title></svelte:head>

<div class="flex flex-col gap-6 p-4 sm:p-6">
	<h2 class="text-lg font-semibold text-slate-900">Кадастровые участки</h2>

	<div class="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
		<label class="flex flex-col gap-1 text-xs text-slate-500">
			Кадастровый номер
			<input
				bind:value={newNumber}
				placeholder="41:01:0000000:1"
				class="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
			/>
		</label>
		<button
			type="button"
			disabled={busy}
			onclick={add}
			class="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
		>
			Добавить
		</button>
		<button
			type="button"
			onclick={check}
			class="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
		>
			Проверить доступность ФГИС
		</button>
		{#if checkResult}<p class="w-full text-xs text-slate-500">{checkResult}</p>{/if}
	</div>

	{#if error}<p class="text-sm text-red-700">{error}</p>{/if}

	{#if loading}
		<p class="text-sm text-slate-500">Загружаем…</p>
	{:else if items.length === 0}
		<p class="text-sm text-slate-500">Участков пока нет.</p>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each items as parcel (parcel.id)}
				<li class="rounded-lg border border-slate-200 bg-white p-4">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div>
							<p class="font-medium text-slate-900">{parcel.cadastral_number}</p>
							<p class="text-xs text-slate-500">
								{parcel.area_ha ? `${parcel.area_ha.toFixed(1)} га` : 'площадь неизвестна'} ·
								{parcel.source === 'manual' ? 'границы введены вручную' : 'Росреестр'} ·
								{formatDate(parcel.created_at)}
							</p>
						</div>
						<div class="flex items-center gap-2">
							<StatusPill
								label={STATUS_LABEL[parcel.status]}
								tone={parcel.status === 'resolved'
									? 'positive'
									: parcel.status === 'failed'
										? 'negative'
										: 'warning'}
							/>
							{#if parcel.status === 'failed'}
								<button
									type="button"
									onclick={() => retry(parcel.id)}
									class="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
								>
									Повторить
								</button>
							{/if}
							<button
								type="button"
								onclick={() => remove(parcel.id)}
								class="rounded-full border border-red-200 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
							>
								Удалить
							</button>
						</div>
					</div>

					{#if parcel.status === 'failed'}
						<div class="mt-3 flex flex-col gap-2">
							{#if parcel.resolve_error}
								<p class="text-xs text-red-700">{parcel.resolve_error}</p>
							{/if}
							<label class="flex flex-col gap-1 text-xs text-slate-500">
								Границы вручную (GeoJSON-геометрия)
								<textarea
									value={geometryDrafts[parcel.id] ?? ''}
									oninput={(e) =>
										(geometryDrafts = {
											...geometryDrafts,
											[parcel.id]: e.currentTarget.value
										})}
									rows="3"
									placeholder={'{"type":"Polygon","coordinates":[[[...]]]}'}
									class="resize-none rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900"
								></textarea>
							</label>
							<button
								type="button"
								disabled={busy}
								onclick={() => setGeometry(parcel.id)}
								class="self-start rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-60"
							>
								Сохранить границы
							</button>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
