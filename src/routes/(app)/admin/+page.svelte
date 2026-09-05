<script lang="ts">
	import DashboardEmbed from '$lib/components/DashboardEmbed.svelte';
</script>

<svelte:head><title>Обзор · Админ-панель</title></svelte:head>

<div class="flex flex-col gap-6 p-4 sm:p-6">
	<h2 class="text-lg font-semibold text-slate-900">Воронка и обучение</h2>
	<DashboardEmbed slug="funnel" />
</div>
