<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import TopBar from '$lib/components/TopBar.svelte';
	import { reports } from '$lib/state/reports.svelte';
	import { session } from '$lib/state/session.svelte';

	let { data, children } = $props();

	let hydrated = false;
	$effect(() => {
		if (hydrated) return;
		reports.hydrate(data.reports);
		hydrated = true;
	});

	$effect(() => {
		if (session.ready && !session.user) goto(resolve('/login'), { replaceState: true });
	});
</script>

<div class="flex h-dvh flex-col bg-slate-100">
	{#if session.user}
		<TopBar />
		<main class="relative min-h-0 flex-1">
			{@render children()}
		</main>
	{/if}
</div>
