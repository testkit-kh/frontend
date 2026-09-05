<script lang="ts">
	import { ApiError } from '$lib/api/client';
	import { notifications, type Schemas } from '$lib/api/endpoints';

	let result = $state<Schemas['ReminderDispatchOut'] | null>(null);
	let error = $state<string | null>(null);
	let busy = $state(false);

	async function run(dryRun: boolean) {
		busy = true;
		error = null;
		result = null;
		try {
			result = await notifications.dispatchReminders(dryRun);
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось запустить рассылку';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Напоминания · Админ-панель</title></svelte:head>

<div class="flex max-w-xl flex-col gap-4 p-4 sm:p-6">
	<h2 class="text-lg font-semibold text-slate-900">Напоминания</h2>
	<p class="text-sm text-slate-500">
		Планировщик и так тикает раз в час — эта кнопка нужна для демонстрации, чтобы не ждать цикл:
		dry-run показывает, кому и что уйдёт, ничего не меняя.
	</p>

	<div class="flex flex-wrap gap-3">
		<button
			type="button"
			disabled={busy}
			onclick={() => run(true)}
			class="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
		>
			Прогнать (dry-run)
		</button>
		<button
			type="button"
			disabled={busy}
			onclick={() => run(false)}
			class="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
		>
			Отправить по-настоящему
		</button>
	</div>

	{#if error}<p class="text-sm text-red-700">{error}</p>{/if}

	{#if result}
		<div class="rounded-lg border border-slate-200 bg-white p-4 text-sm">
			<p>Назрело: {result.due}</p>
			<p>Отправлено: {result.sent}</p>
			{#if result.preview.length > 0}
				<ul class="mt-2 list-disc pl-5 text-xs text-slate-500">
					{#each result.preview as line (line)}
						<li>{line}</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>
