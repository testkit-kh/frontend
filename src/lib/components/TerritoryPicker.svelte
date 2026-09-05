<script lang="ts">
	import { ChevronDown, Globe2 } from '@lucide/svelte';
	import { ALL_TERRITORIES, type Territory } from '$lib/data/territories';

	let {
		territories,
		value,
		onchange,
		locked = false,
		myTerritoryId = null
	}: {
		territories: Territory[];
		value: string;
		onchange: (id: string) => void;
		/** Сотрудник ООПТ привязан к своей территории и списка не выбирает. */
		locked?: boolean;
		/** Слаг «моей» ООПТ (не UUID организации). null = матча нет. */
		myTerritoryId?: string | null;
	} = $props();

	const current = $derived(territories.find((t) => t.id === value) ?? null);
	const overview = $derived(value === ALL_TERRITORIES);
	/** Только явный матч — без фолбэка на territories[0] (всегда был Kronotsky). */
	const hasHome = $derived(Boolean(myTerritoryId));
	const onMyTerritory = $derived(hasHome && value === myTerritoryId);

	// Список длинный (19 ООПТ) — группируем по региону, иначе в нём не найти
	// нужную территорию глазами.
	const byRegion = $derived.by(() => {
		const groups: Array<[string, Territory[]]> = [];
		for (const territory of territories) {
			const group = groups.find(([region]) => region === territory.region);
			if (group) group[1].push(territory);
			else groups.push([territory.region, [territory]]);
		}
		return groups.sort(([a], [b]) => a.localeCompare(b, 'ru'));
	});

	function pickHome() {
		// Нет матча → обзор страны, а не первая ООПТ из списка.
		onchange(myTerritoryId ?? ALL_TERRITORIES);
	}
</script>

{#if locked}
	<!-- Сотруднику список не нужен, но обзор страны — нужен: понять, где ещё
	     идёт работа, полезно и ему. Поэтому не текст, а переключатель. -->
	<div class="flex gap-1 rounded-full bg-slate-100 p-1 text-xs">
		<button
			type="button"
			aria-pressed={onMyTerritory}
			title={hasHome
				? undefined
				: 'Организация не сопоставлена с ООПТ на карте — показан обзор страны'}
			onclick={pickHome}
			class="min-h-9 flex-1 truncate rounded-full px-3 text-slate-600 aria-pressed:bg-white aria-pressed:font-medium aria-pressed:text-slate-900"
		>
			Моя территория
		</button>
		<button
			type="button"
			aria-pressed={overview}
			onclick={() => onchange(ALL_TERRITORIES)}
			class="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-slate-600 aria-pressed:bg-white aria-pressed:font-medium aria-pressed:text-slate-900"
		>
			<Globe2 size={13} /> Вся Россия
		</button>
	</div>
{:else}
	<div class="relative">
		<select
			{value}
			onchange={(event) => onchange(event.currentTarget.value)}
			aria-label="Территория"
			class="min-h-11 w-full appearance-none rounded-lg border border-slate-300 py-2 pr-9 pl-3 text-sm text-slate-900"
		>
			<option value={ALL_TERRITORIES}>🌍 Вся Россия — {territories.length} территорий</option>
			{#each byRegion as [region, list] (region)}
				<optgroup label={region}>
					{#each list as territory (territory.id)}
						<option value={territory.id}>{territory.name}</option>
					{/each}
				</optgroup>
			{/each}
		</select>
		<ChevronDown
			size={16}
			class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-slate-400"
		/>
	</div>
	{#if current}
		<p class="mt-1 text-xs text-slate-500">{current.region} · {current.waterBody}</p>
	{/if}
{/if}
