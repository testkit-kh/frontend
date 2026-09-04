<script lang="ts">
	import { LogOut, Map, Satellite, Waves } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { session } from '$lib/state/session.svelte';
	import type { Territory } from '$lib/data/territories';

	const user = $derived(session.user);

	// Название ООПТ берётся из загруженных территорий, а не зашивается в вёрстку:
	// в проекте их 19, от Кроноцкого до Куршской косы.
	const territories = $derived((page.data?.territories ?? []) as Territory[]);
	const orgName = $derived(
		territories.find((t) => t.id === user?.organizationId)?.name ?? ''
	);

	const links = $derived(
		user?.role === 'staff'
			? [
					{ href: resolve('/map'), label: 'Карта', icon: Map },
					{ href: resolve('/moderate'), label: 'Предложка', icon: Satellite }
				]
			: [{ href: resolve('/map'), label: 'Карта', icon: Map }]
	);

	function logout() {
		session.logout();
		goto(resolve('/login'));
	}
</script>

<header class="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-3">
	<a href={resolve('/map')} class="flex items-center gap-2 text-slate-900">
		<Waves size={20} class="text-emerald-600" />
		<span class="text-sm font-semibold">Чистый берег</span>
	</a>

	<nav class="flex items-center gap-1">
		{#each links as link (link.href)}
			{@const active = page.url.pathname === link.href}
			<a
				href={link.href}
				aria-current={active ? 'page' : undefined}
				class="flex items-center gap-2 rounded-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 aria-[current]:bg-slate-900 aria-[current]:text-white"
			>
				<link.icon size={16} />
				{link.label}
			</a>
		{/each}
	</nav>

	<div class="flex-1"></div>

	{#if user}
		<div class="hidden text-right sm:block">
			<p class="text-sm font-medium text-slate-900">{user.name}</p>
			<p class="text-xs text-slate-500">
				{user.role === 'staff' ? `Сотрудник ООПТ${orgName ? ` · ${orgName}` : ''}` : 'Волонтёр'}
			</p>
		</div>
		<button
			type="button"
			onclick={logout}
			aria-label="Выйти"
			title="Выйти"
			class="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
		>
			<LogOut size={16} />
		</button>
	{/if}
</header>
