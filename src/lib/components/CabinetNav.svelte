<script lang="ts">
	import type { ResolvedPathname } from '$app/types';
	import { page } from '$app/state';
	import type { Component } from 'svelte';

	// href — уже результат resolve() от вызывающего layout'а; тип сохраняем,
	// а не расширяем до string, иначе линт svelte/no-navigation-without-resolve
	// перестаёт видеть, что ссылка разрешена.
	type Link = { href: ResolvedPathname; label: string; icon: Component };

	let { links, title }: { links: Link[]; title: string } = $props();
</script>

<aside class="flex w-full shrink-0 flex-col border-slate-200 bg-white sm:w-56 sm:border-r lg:w-64">
	<h1 class="border-b border-slate-200 p-4 text-sm font-semibold text-slate-900 sm:border-b-0">
		{title}
	</h1>
	<nav class="flex gap-1 overflow-x-auto p-2 sm:flex-col sm:overflow-visible">
		{#each links as link (link.href)}
			{@const active = page.url.pathname === link.href}
			<a
				href={link.href}
				aria-current={active ? 'page' : undefined}
				class="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 aria-[current]:bg-slate-900 aria-[current]:text-white"
			>
				<link.icon size={16} />
				{link.label}
			</a>
		{/each}
	</nav>
</aside>
