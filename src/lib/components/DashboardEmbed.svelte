<script lang="ts">
	import { ApiError } from '$lib/api/client';
	import { analytics } from '$lib/api/endpoints';

	let { slug }: { slug: 'funnel' | 'oopt' | 'impact' } = $props();

	let url = $state<string | null>(null);
	let unavailable = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		url = null;
		unavailable = false;
		error = null;
		analytics
			.embed(slug)
			.then((res) => {
				url = res.url;
			})
			.catch((err) => {
				// 503 — Metabase ещё не запровижен (scripts/metabase_seed.py не
				// запускали). Это ожидаемое состояние на раннем стенде, а не сбой.
				if (err instanceof ApiError && err.isUnavailable) {
					unavailable = true;
					return;
				}
				error = err instanceof ApiError ? err.message : 'Не удалось загрузить дашборд';
			});
	});
</script>

{#if unavailable}
	<div
		class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500"
	>
		Дашборд ещё не подключён (Metabase не запровижен на этом стенде).
	</div>
{:else if error}
	<div class="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
{:else if url}
	<iframe
		src={url}
		title="Дашборд {slug}"
		class="h-[70vh] w-full rounded-xl border border-slate-200"
	></iframe>
{:else}
	<div class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
		Загружаем дашборд…
	</div>
{/if}
