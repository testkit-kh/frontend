<script lang="ts">
	import { onMount } from 'svelte';

	/**
	 * Лист снизу на телефоне — боковая панель на широком экране.
	 *
	 * Зачем: карта здесь и есть содержание, а панель шириной 320px абсолютом
	 * поверх неё съедает почти весь экран телефона. Лист решает это тем, что
	 * у него три положения: сложен до ручки, наполовину и целиком. В любом
	 * из них видна карта — а именно на неё человек и ставит точку.
	 *
	 * Полноценного перетаскивания намеренно нет: свайп внутри листа конфликтует
	 * с прокруткой списка, а на берегу в перчатках промахнуться легче, чем
	 * попасть. Положение переключается кнопкой и тапом по ручке — предсказуемо.
	 */
	type Snap = 'peek' | 'half' | 'full';

	let {
		snap = $bindable('half'),
		label,
		header,
		children,
		footer
	}: {
		snap?: Snap;
		label: string;
		header?: import('svelte').Snippet;
		children: import('svelte').Snippet;
		footer?: import('svelte').Snippet;
	} = $props();

	const ORDER: Snap[] = ['peek', 'half', 'full'];

	/** Высоты листа. `dvh`, а не `vh`: адресная строка мобильного браузера
	 *  съедает часть экрана, и на `vh` низ листа уезжает под неё. */
	const HEIGHT: Record<Snap, string> = {
		peek: '4.5rem',
		half: '45dvh',
		full: '85dvh'
	};

	function cycle() {
		snap = ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length];
	}

	let desktop = $state(false);
	onMount(() => {
		const query = window.matchMedia('(min-width: 768px)');
		const sync = () => (desktop = query.matches);
		sync();
		query.addEventListener('change', sync);
		return () => query.removeEventListener('change', sync);
	});
</script>

<aside
	aria-label={label}
	class="pointer-events-auto absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white
	       md:inset-x-auto md:inset-y-4 md:left-4 md:w-80 md:rounded-lg"
	style="height: {desktop ? 'auto' : HEIGHT[snap]}; padding-bottom: env(safe-area-inset-bottom)"
>
	<!-- Ручка: и визуальный признак листа, и кнопка переключения высоты.
	     На широком экране листа нет, поэтому она скрыта. -->
	<button
		type="button"
		onclick={cycle}
		aria-label="Развернуть или свернуть панель"
		class="flex w-full shrink-0 justify-center py-3 md:hidden"
	>
		<span class="h-1 w-10 rounded-full bg-slate-300"></span>
	</button>

	{#if header}
		<div class="shrink-0">{@render header()}</div>
	{/if}

	<!-- Прокрутка только у содержимого: шапка и подвал листа стоят на месте,
	     иначе кнопка «Сообщить» уезжает из-под пальца. -->
	<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
		{@render children()}
	</div>

	{#if footer}
		<div class="shrink-0 border-t border-slate-200">{@render footer()}</div>
	{/if}
</aside>
