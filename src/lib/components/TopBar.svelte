<script lang="ts">
	import { Bell, GraduationCap, LogOut, Map, Satellite } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { session } from '$lib/state/session.svelte';
	import { reports } from '$lib/state/reports.svelte';
	import { overallMood } from '$lib/state/health';
	import { unread } from '$lib/state/notifications.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import type { Territory } from '$lib/data/territories';

	const profile = $derived(session.profile);

	// Название ООПТ берётся из загруженных территорий, а не зашивается в вёрстку:
	// в проекте их 19, от Кроноцкого до Куршской косы.
	const territories = $derived((page.data?.territories ?? []) as Territory[]);
	const orgName = $derived(territories.find((t) => t.id === session.organizationId)?.name ?? '');

	// Знак в шапке живой: хмурится, когда по стране много неубранных точек.
	// Это единственный индикатор состояния, который человек видит всегда.
	const mood = $derived(overallMood(reports.items));

	// Волонтёру без доступа к карте нечего на ней делать — ведём на обучение,
	// иначе он упрётся в редирект гварда и не поймёт, что от него хотят.
	const links = $derived(
		session.isStaff
			? [
					{ href: resolve('/map'), label: 'Карта', icon: Map },
					{ href: resolve('/moderate'), label: 'Предложка', icon: Satellite }
				]
			: session.hasMapAccess
				? [{ href: resolve('/map'), label: 'Карта', icon: Map }]
				: [{ href: resolve('/course'), label: 'Обучение', icon: GraduationCap }]
	);

	// Счётчик тянем один раз при появлении профиля: колокольчик не должен
	// опрашивать сервер в цикле.
	$effect(() => {
		if (session.profile) unread.refresh();
	});

	function logout() {
		session.logout();
		goto(resolve('/login'));
	}
</script>

<header
	class="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:gap-4 sm:px-4 sm:py-3"
	style="padding-top: max(0.5rem, env(safe-area-inset-top))"
>
	<a href={resolve('/map')} class="flex shrink-0 items-center gap-2 text-slate-900">
		<Logo {mood} size={30} title="Чистый берег" />
		<span class="hidden text-sm font-semibold sm:inline">Чистый берег</span>
	</a>

	<nav class="flex items-center gap-1">
		{#each links as link (link.href)}
			{@const active = page.url.pathname === link.href}
			<a
				href={link.href}
				aria-current={active ? 'page' : undefined}
				class="flex min-h-11 items-center gap-2 rounded-full px-3 text-sm text-slate-600 hover:bg-slate-100 aria-[current]:bg-slate-900 aria-[current]:text-white sm:px-4"
			>
				<link.icon size={16} />
				<span class="hidden sm:inline">{link.label}</span>
			</a>
		{/each}
	</nav>

	<div class="flex-1"></div>

	{#if profile}
		<div class="hidden min-w-0 text-right md:block">
			<p class="truncate text-sm font-medium text-slate-900">{profile.full_name}</p>
			<p class="truncate text-xs text-slate-500">
				{session.isStaff ? `Сотрудник ООПТ${orgName ? ` · ${orgName}` : ''}` : 'Волонтёр'}
			</p>
		</div>
		<a
			href={resolve('/notifications')}
			aria-label="Уведомления{unread.count ? `, непрочитанных: ${unread.count}` : ''}"
			class="relative flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
		>
			<Bell size={16} />
			{#if unread.count > 0}
				<span
					class="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-medium text-white"
				>
					{unread.count > 9 ? '9+' : unread.count}
				</span>
			{/if}
		</a>
		<button
			type="button"
			onclick={logout}
			aria-label="Выйти"
			title="Выйти"
			class="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
		>
			<LogOut size={16} />
		</button>
	{/if}
</header>
