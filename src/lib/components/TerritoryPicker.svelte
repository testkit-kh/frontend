<script lang="ts">
	import { ChevronDown, Lock } from '@lucide/svelte';
	import type { Territory } from '$lib/data/territories';

	let {
		territories,
		value,
		onchange,
		locked = false
	}: {
		territories: Territory[];
		value: string;
		onchange: (id: string) => void;
		locked?: boolean;
	} = $props();

	const current = $derived(territories.find((t) => t.id === value) ?? territories[0]);
</script>

{#if locked}
	<p class="flex items-center gap-2 text-xs text-slate-500">
		<Lock size={13} class="shrink-0" />
		{current.fullName} · {current.region}
	</p>
{:else}
	<div class="relative">
		<select
			{value}
			onchange={(event) => onchange(event.currentTarget.value)}
			aria-label="Территория"
			class="w-full appearance-none rounded-lg border border-slate-300 py-2 pr-9 pl-3 text-sm text-slate-900"
		>
			{#each territories as territory (territory.id)}
				<option value={territory.id}>{territory.name} · {territory.region}</option>
			{/each}
		</select>
		<ChevronDown
			size={16}
			class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-slate-400"
		/>
	</div>
{/if}
