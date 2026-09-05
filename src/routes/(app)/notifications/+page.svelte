<script lang="ts">
	import { BellOff, CheckCheck, TriangleAlert } from '@lucide/svelte';
	import { ApiError } from '$lib/api/client';
	import { course, notifications as api, type Notification } from '$lib/api/endpoints';
	import { formatDate } from '$lib/format';
	import { unread } from '$lib/state/notifications.svelte';

	/**
	 * Лента уведомлений.
	 *
	 * Переход из напоминания идёт по ссылке с `?nid=`, а не просто на нужный
	 * экран: только так на бэкенде фиксируется `reminder_clicked`, а без него
	 * возврат по напоминанию неотличим от органического — и KPI эффективности
	 * напоминаний посчитать нечем.
	 */

	let items = $state<Notification[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function load() {
		loading = true;
		error = null;
		try {
			const response = await api.list();
			items = response.items;
			unread.set(response.unread_count);
		} catch (cause) {
			error = cause instanceof ApiError ? cause.message : 'Не удалось загрузить уведомления';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	async function markRead(notification: Notification) {
		if (notification.read_at) return;
		try {
			const updated = await api.markRead(notification.id);
			items = items.map((item) => (item.id === updated.id ? updated : item));
			unread.decrement();
		} catch {
			/* не критично: прочитанность догонит при следующей загрузке */
		}
	}

	async function markAllRead() {
		try {
			await api.markAllRead();
			const now = new Date().toISOString();
			items = items.map((item) => ({ ...item, read_at: item.read_at ?? now }));
			unread.set(0);
		} catch (cause) {
			error = cause instanceof ApiError ? cause.message : 'Не удалось отметить прочитанным';
		}
	}

	/** Куда ведёт уведомление. Для напоминания о курсе — через бэкенд с `nid`. */
	function linkFor(notification: Notification): string {
		if (notification.kind === 'course_not_started' || notification.kind === 'course_not_finished') {
			return course.redirectUrl(notification.id);
		}
		return notification.action_url ?? '/map';
	}

	const hasUnread = $derived(items.some((item) => !item.read_at));
</script>

<svelte:head><title>Уведомления · Чистый берег</title></svelte:head>

<div class="h-full overflow-y-auto">
	<div class="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-16 sm:p-6">
		<header class="flex items-center justify-between gap-3">
			<h1 class="text-xl font-semibold text-slate-900">Уведомления</h1>
			{#if hasUnread}
				<button
					type="button"
					onclick={markAllRead}
					class="flex min-h-11 items-center gap-2 rounded-full px-3 text-sm text-slate-600 hover:bg-slate-100"
				>
					<CheckCheck size={16} /> Прочитано
				</button>
			{/if}
		</header>

		{#if loading}
			<p class="text-sm text-slate-500">Загружаем…</p>
		{:else if error}
			<div class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
				<TriangleAlert size={16} class="mt-0.5 shrink-0 text-red-500" />
				<div class="flex-1">
					<p class="text-red-800">{error}</p>
					<button type="button" onclick={load} class="mt-2 font-medium text-red-900 underline">
						Попробовать снова
					</button>
				</div>
			</div>
		{:else if items.length === 0}
			<div
				class="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white p-10 text-center"
			>
				<BellOff size={28} class="text-slate-300" />
				<p class="text-sm text-slate-500">Пока ничего. Здесь появятся ответы по вашим точкам.</p>
			</div>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each items as notification (notification.id)}
					<li>
						<!-- Адрес приходит с сервера и для напоминаний о курсе указывает на
						     ручку API, а не на роут приложения: resolve() к нему неприменим. -->
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							href={linkFor(notification)}
							onclick={() => markRead(notification)}
							class="flex gap-3 rounded-lg border p-4 transition-colors {notification.read_at
								? 'border-slate-200 bg-white'
								: 'border-sky-200 bg-sky-50'}"
						>
							<span
								class="mt-1.5 h-2 w-2 shrink-0 rounded-full {notification.read_at
									? 'bg-transparent'
									: 'bg-sky-500'}"
								aria-hidden="true"
							></span>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium text-slate-900">{notification.title}</p>
								{#if notification.body}
									<p class="mt-0.5 text-sm text-slate-600">{notification.body}</p>
								{/if}
								<p class="mt-1 text-xs text-slate-400">
									{formatDate(notification.created_at)}
									{#if !notification.read_at}· новое{/if}
								</p>
							</div>
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
