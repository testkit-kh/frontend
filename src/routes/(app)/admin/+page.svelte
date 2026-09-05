<script lang="ts">
	import DashboardEmbed from '$lib/components/DashboardEmbed.svelte';
</script>

<svelte:head><title>Обзор · Админ-панель</title></svelte:head>

<div class="flex flex-col gap-6 p-4 sm:p-6">
	<div>
		<h2 class="text-lg font-semibold text-slate-900">Воронка и обучение</h2>
		<div class="mt-3">
			<DashboardEmbed slug="funnel" />
		</div>
	</div>

	<div>
		<h2 class="text-lg font-semibold text-slate-900">Экологический эффект</h2>
		<div class="mt-3">
			<DashboardEmbed slug="impact" />
		</div>
	</div>
</div>
