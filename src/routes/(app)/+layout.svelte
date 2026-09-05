<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import TopBar from '$lib/components/TopBar.svelte';
	import { reports } from '$lib/state/reports.svelte';
	import { session } from '$lib/state/session.svelte';
	import { offlineQueue } from '$lib/state/offlineQueue.svelte';
	import { onboardingState } from '$lib/state/onboarding.svelte';

	let { data, children } = $props();

	let hydrated = false;
	$effect(() => {
		if (hydrated) return;
		reports.hydrate(data.reports);
		offlineQueue.init();
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
	 * «знакомство» (онбординг), потом «есть ли согласие», потом «пройдено ли
	 * обучение». Фронт здесь не решает, пускать ли — он лишь ведёт человека к
	 * следующему шагу, а настоящую проверку всё равно делает API. Дублировать
	 * правила доступа на клиенте значит получить два расходящихся набора.
	 *
	 * Онбординг — единственный шаг, о котором знает только фронт: анкета об
	 * образовании и подобранная по OSM граница территории бэкенду пока негде
	 * хранить (см. `api/onboarding.ts`). Поэтому «пройден» держится локально и
	 * показывается один раз на устройство — и всегда с кнопкой «пропустить».
	 *
	 * Координатор через воронку не идёт вовсе: ни курса, ни согласия, ни
	 * территории у него нет, а `/admin` проверяет роль в своём layout'е.
	 */
	const ALWAYS_ALLOWED = ['/course', '/consent', '/notifications', '/onboarding', '/offline'];

	// Анкеты лежат по id пользователя: под одним браузером в школьном классе
	// заходят разные люди, и чужие ответы одному показывать нельзя.
	$effect(() => {
		if (session.profile) onboardingState.load(session.profile.id);
	});

	$effect(() => {
		if (!session.ready) return;

		if (!session.profile) {
			goto(resolve('/login'), { replaceState: true });
			return;
		}
		if (session.isCoordinator) return;

		const path = page.url.pathname;
		if (ALWAYS_ALLOWED.some((allowed) => path.endsWith(allowed))) return;

		if (!onboardingState.done) {
			goto(resolve('/onboarding'), { replaceState: true });
			return;
		}
		if (session.role !== 'volunteer') return;

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
