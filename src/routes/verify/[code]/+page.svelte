<script lang="ts">
	import { CircleCheck, CircleX, TriangleAlert } from '@lucide/svelte';

	let { data } = $props();
	const v = $derived(data.verification);
</script>

<svelte:head>
	<title>Сертификат №{data.code} · Чистый берег</title>
	<meta
		name="description"
		content="Проверка подлинности сертификата волонтёра проекта «Чистый берег»."
	/>
	<meta property="og:title" content="Сертификат №{data.code} · Чистый берег" />
	<meta
		property="og:description"
		content="Проверка подлинности сертификата волонтёра проекта «Чистый берег»."
	/>
	<meta property="og:image" content="/icons/icon.svg" />
</svelte:head>

<div class="flex min-h-dvh items-center justify-center bg-slate-100 p-4">
	<div class="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center">
		{#if v.valid && !v.revoked}
			<CircleCheck size={40} class="mx-auto text-emerald-600" />
			<h1 class="mt-3 text-lg font-semibold text-slate-900">Сертификат подлинный</h1>
			<dl class="mt-4 flex flex-col gap-2 text-left text-sm">
				<div class="flex justify-between gap-3">
					<dt class="text-slate-500">Волонтёр</dt>
					<dd class="font-medium text-slate-900">{v.full_name}</dd>
				</div>
				<div class="flex justify-between gap-3">
					<dt class="text-slate-500">Курс</dt>
					<dd class="font-medium text-slate-900">{v.course}</dd>
				</div>
				<div class="flex justify-between gap-3">
					<dt class="text-slate-500">Дата выдачи</dt>
					<dd class="font-medium text-slate-900">
						{new Date(v.issued_at).toLocaleDateString('ru-RU')}
					</dd>
				</div>
				<div class="flex justify-between gap-3">
					<dt class="text-slate-500">Точек подтверждено</dt>
					<dd class="font-medium text-slate-900">{v.points_confirmed}</dd>
				</div>
				<div class="flex justify-between gap-3">
					<dt class="text-slate-500">Часов</dt>
					<dd class="font-medium text-slate-900">{v.hours}</dd>
				</div>
			</dl>
		{:else if v.valid && v.revoked}
			<TriangleAlert size={40} class="mx-auto text-amber-500" />
			<h1 class="mt-3 text-lg font-semibold text-slate-900">Сертификат отозван</h1>
			<p class="mt-2 text-sm text-slate-500">
				Отозван {new Date(v.revoked_at).toLocaleDateString('ru-RU')}.
			</p>
		{:else}
			<CircleX size={40} class="mx-auto text-slate-300" />
			<h1 class="mt-3 text-lg font-semibold text-slate-900">Сертификат не найден</h1>
			<p class="mt-2 text-sm text-slate-500">
				Проверьте номер №{data.code} или обратитесь к волонтёру за корректной ссылкой.
			</p>
		{/if}
	</div>
</div>
