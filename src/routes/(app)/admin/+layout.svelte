<script lang="ts">
	import { Bell, Building, FileCheck2, LayoutDashboard, UserCheck } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CabinetNav from '$lib/components/CabinetNav.svelte';
	import { session } from '$lib/state/session.svelte';

	let { children } = $props();

	// Админ-панель — только для координаторов программы. Волонтёра и
	// сотрудника ООПТ сюда не пускаем: у них свои разделы (`/map`, `/org`).
	$effect(() => {
		if (session.ready && !session.isCoordinator) {
			goto(resolve(session.landingPath), { replaceState: true });
		}
	});

	const links = [
		{ href: resolve('/admin'), label: 'Обзор', icon: LayoutDashboard },
		{ href: resolve('/admin/certificates'), label: 'Сертификаты', icon: FileCheck2 },
		{ href: resolve('/admin/consents'), label: 'Согласия', icon: UserCheck },
		{ href: resolve('/admin/organizations'), label: 'Организации', icon: Building },
		{ href: resolve('/admin/reminders'), label: 'Напоминания', icon: Bell }
	];
</script>

<svelte:head><title>Админ-панель · Чистый берег</title></svelte:head>

{#if session.isCoordinator}
	<div class="flex h-full flex-col sm:flex-row">
		<CabinetNav {links} title="Координатор" />
		<div class="min-w-0 flex-1 overflow-y-auto">
			{@render children()}
		</div>
	</div>
{/if}
