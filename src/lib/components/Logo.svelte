<script lang="ts">
	/**
	 * Знак «Чистого берега»: суша, вода и погода над ними.
	 *
	 * Два настроения — не украшение, а индикатор состояния территории:
	 * `clean` (солнце, улыбка) — неубранных точек мало,
	 * `dirty` (туча с молнией, хмурое лицо) — берег требует внимания.
	 * Считается в `$lib/state/health.ts`, чтобы правило было одно на всё
	 * приложение, а не по-разному в каждом месте, где рисуется знак.
	 *
	 * Пути воспроизведены по фирменному знаку. Если появятся исходники —
	 * заменить содержимое <svg>, не трогая остальное: наружу компонент
	 * отдаёт только `mood`, `size` и `title`.
	 */
	type Mood = 'clean' | 'dirty';

	let {
		mood = 'clean',
		size = 40,
		title,
		class: className = ''
	}: {
		mood?: Mood;
		size?: number;
		/** Подпись для скринридера. Пусто — знак считается декоративным. */
		title?: string;
		class?: string;
	} = $props();

	const LAND = '#3b4a15';
	const WATER = '#8ad4f5';
	const CREAM = '#f8efdc';
	const SUN = '#ffc41f';
	const CLOUD = '#adadad';
	const BOLT = '#ff4713';
</script>

<svg
	viewBox="0 0 128 116"
	width={size}
	height={(size * 116) / 128}
	fill="none"
	class={className}
	role={title ? 'img' : 'presentation'}
	aria-label={title}
	aria-hidden={title ? undefined : 'true'}
>
	{#if title}<title>{title}</title>{/if}

	<!-- Суша -->
	<path
		d="M14 44C18 20 44 8 70 12c24 4 42 22 44 44 2 24-14 46-40 50-28 4-52-10-58-30-4-14-4-24-2-32Z"
		fill={LAND}
	/>

	<!-- Вода: заходит на сушу слева и снизу, как прибой -->
	<path
		d="M2 58C-2 38 8 22 20 24c10 2 12 14 8 22-3 7 2 12 10 12 10 0 18-6 28-4 12 2 20 10 22 22 3 18-14 34-40 34C20 110 6 92 2 58Z"
		fill={WATER}
	/>
	<path
		d="M30 74c8-6 16-2 22 2 7 5 14 6 22 2 8-4 16-2 22 6 4 6 4 14 0 20H36c-8-6-12-16-6-30Z"
		fill={WATER}
	/>

	{#if mood === 'clean'}
		<!-- Спокойные волны -->
		<path
			d="M32 44c0-8 5-13 10-13s10 5 10 13"
			stroke={CREAM}
			stroke-width="7"
			stroke-linecap="round"
		/>
		<path
			d="M58 44c0-8 5-13 10-13s10 5 10 13"
			stroke={CREAM}
			stroke-width="7"
			stroke-linecap="round"
		/>
		<!-- Солнце -->
		<path
			d="m92 6 6 16 16-8-6 16 18 4-18 6 8 16-16-8-4 18-6-18-14 8 6-16-16-6 16-4-6-16 16 8Z"
			fill={SUN}
		/>
	{:else}
		<!-- Хмурые волны: те же линии, но опущенные -->
		<path
			d="M30 34c6 6 10 10 14 16"
			stroke={CREAM}
			stroke-width="7"
			stroke-linecap="round"
		/>
		<path
			d="M62 32c-4 8-6 14-6 20"
			stroke={CREAM}
			stroke-width="7"
			stroke-linecap="round"
		/>
		<path
			d="M40 58c10-6 22-6 34 2"
			stroke={CREAM}
			stroke-width="7"
			stroke-linecap="round"
		/>
		<!-- Туча -->
		<path
			d="M96 4c14 0 24 9 24 20 6 0 10 5 10 11s-4 11-10 11H88c-8 0-14-6-14-13 0-6 4-11 10-12-1-10 6-17 12-17Z"
			fill={CLOUD}
		/>
		<!-- Молния -->
		<path d="M104 40h14l-14 20h10L96 78l4-20h-8l12-18Z" fill={BOLT} />
	{/if}
</svg>
