<script lang="ts">
	import { Satellite, Sprout } from '@lucide/svelte';
	import type { Role } from '$lib/types';

	let { role = $bindable() }: { role: Role } = $props();

	const options = [
		{ value: 'volunteer' as const, label: 'Волонтёр', hint: 'от 14 лет', icon: Sprout },
		{ value: 'staff' as const, label: 'Сотрудник ООПТ', hint: 'проверяет точки', icon: Satellite }
	];
</script>

<fieldset class="flex flex-col gap-1">
	<legend class="pb-1 text-xs text-slate-500">Я захожу как</legend>
	<div class="grid grid-cols-2 gap-3">
		{#each options as option (option.value)}
			<button
				type="button"
				aria-pressed={role === option.value}
				onclick={() => (role = option.value)}
				class="flex flex-col items-start gap-1 rounded-lg border border-slate-200 p-4 text-left hover:border-slate-300 aria-pressed:border-slate-900 aria-pressed:bg-slate-900 aria-pressed:text-white"
			>
				<option.icon size={18} />
				<span class="text-sm font-medium">{option.label}</span>
				<span class="text-xs opacity-70">{option.hint}</span>
			</button>
		{/each}
	</div>
</fieldset>
