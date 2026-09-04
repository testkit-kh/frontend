<script lang="ts">
	import { Satellite, Users, Waves } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="grid h-dvh grid-cols-1 overflow-y-auto bg-white lg:grid-cols-2">
	<section class="hidden flex-col justify-between gap-4 bg-slate-900 p-4 text-white lg:flex">
		<div class="flex items-center gap-2 p-4">
			<Waves size={20} class="text-emerald-400" />
			<span class="text-sm font-semibold">Чистый берег</span>
		</div>

		<div class="flex max-w-md flex-col gap-4 p-4">
			<h1 class="text-3xl font-semibold">Находим загрязнения из космоса. Убираем ногами.</h1>
			<p class="text-sm text-slate-300">
				Волонтёры размечают спутниковые снимки и присылают находки с берега. Сотрудники ООПТ
				проверяют их и назначают выезды.
			</p>

			<div class="flex flex-col gap-3 pt-4">
				<div class="flex items-start gap-3">
					<Satellite size={18} class="mt-0.5 shrink-0 text-emerald-400" />
					<p class="text-sm text-slate-300">
						<span class="font-medium text-white">Обучение ДЗЗ</span> — как отличить разлив мазута от тени
						облака.
					</p>
				</div>
				<div class="flex items-start gap-3">
					<Users size={18} class="mt-0.5 shrink-0 text-emerald-400" />
					<p class="text-sm text-slate-300">
						<span class="font-medium text-white">Сертификат и выезды</span> — навык, который видно в резюме,
						и уборка, которую видно со спутника.
					</p>
				</div>
			</div>
		</div>

		<p class="p-4 text-xs text-slate-500">Прототип для Космохакатона</p>
	</section>

	<section class="flex items-center justify-center p-4">
		<div class="flex w-full max-w-sm flex-col gap-4">
			{@render children()}
		</div>
	</section>
</div>
