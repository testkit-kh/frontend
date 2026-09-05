<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { browser } from '$app/environment';

	let { children } = $props();

	// Регистрация в корневом layout, а не в (app): офлайн должен работать и на
	// /login — человек может открыть приложение без связи ещё до входа.
	// В деве этой ручки нет (сборка без Workbox), поэтому просто нет и SW —
	// молчаливый catch, а не ошибка в консоли на каждый dev-запуск.
	if (browser) {
		import('virtual:pwa-register')
			.then(({ registerSW }) => registerSW({ immediate: true }))
			.catch(() => {});
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
