<script lang="ts">
	import { Building2, CalendarDays, Inbox, LandPlot, LayoutDashboard, Waves } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CabinetNav from '$lib/components/CabinetNav.svelte';
	import { session } from '$lib/state/session.svelte';

	let { children } = $props();

	// Кабинет ООПТ — только для сотрудников. Волонтёра и координатора сюда
	// не пускаем: у них свои разделы (`/map`, `/admin`).
	$effect(() => {
		if (session.ready && !session.isStaff) {
			goto(resolve(session.landingPath), { replaceState: true });
		}
	});

	const links = [
		{ href: resolve('/org'), label: 'Обзор', icon: LayoutDashboard },
		{ href: resolve('/org/queue'), label: 'Точки на проверке', icon: Inbox },
		{ href: resolve('/org/events'), label: 'Мероприятия', icon: CalendarDays },
		{ href: resolve('/org/parcels'), label: 'Участки', icon: LandPlot },
		{ href: resolve('/org/monitoring'), label: 'Площадки наблюдений', icon: Waves },
		{ href: resolve('/org/profile'), label: 'Профиль организации', icon: Building2 }
	];
</script>

<svelte:head><title>Кабинет ООПТ · Чистый берег</title></svelte:head>

{#if session.isStaff}
	<div class="flex h-full flex-col sm:flex-row">
		<CabinetNav {links} title="Кабинет ООПТ" />
		<div class="min-w-0 flex-1 overflow-y-auto">
			{@render children()}
		</div>
	</div>
{/if}
