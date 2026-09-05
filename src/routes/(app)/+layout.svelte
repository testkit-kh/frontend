<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
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

	// Сессия восстанавливается один раз при входе в приложение: профиль и
	// вместе с ним статусы обучения и согласия приходят с бэкенда.
	$effect(() => {
		session.restore();
	});

	/**
	 * Гварды воронки.
	 *
	 * Порядок не случаен и повторяет правила бэкенда: сначала «кто ты», потом
	 * «есть ли согласие», потом «пройдено ли обучение». Фронт здесь не решает,
	 * пускать ли — он лишь ведёт человека к следующему шагу, а настоящую
	 * проверку всё равно делает API. Дублировать правила доступа на клиенте
	 * значит получить два расходящихся набора.
	 */
	const ALWAYS_ALLOWED = ['/course', '/consent', '/notifications'];

	$effect(() => {
		if (!session.ready) return;

		const path = page.url.pathname;
		if (!session.profile) {
			goto(resolve('/login'), { replaceState: true });
			return;
		}
		if (ALWAYS_ALLOWED.some((allowed) => path.endsWith(allowed))) return;

		if (session.needsConsent) {
			goto(resolve('/consent'), { replaceState: true });
			return;
		}
		if (!session.hasMapAccess) {
			goto(resolve('/course'), { replaceState: true });
		}
	});
</script>

<div class="flex h-dvh flex-col bg-slate-100">
	{#if !session.ready}
		<div class="flex flex-1 items-center justify-center text-sm text-slate-500">
			Загружаем профиль…
		</div>
	{:else if session.profile}
		<TopBar />
		<main class="relative min-h-0 flex-1">
			{@render children()}
		</main>
	{/if}
</div>
