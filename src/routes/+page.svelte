<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { session } from '$lib/state/session.svelte';

	$effect(() => {
		session.restore();
	});

	$effect(() => {
		if (!session.ready) return;
		goto(resolve(session.profile ? '/map' : '/login'), { replaceState: true });
	});
</script>

<div class="flex h-dvh items-center justify-center bg-slate-50 text-sm text-slate-500">
	Загружаем…
</div>
