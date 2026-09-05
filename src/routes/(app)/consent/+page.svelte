<script lang="ts">
	import { Info } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import ConsentForm from '$lib/components/ConsentForm.svelte';

	/**
	 * Согласие законного представителя для участников 14–17 лет.
	 *
	 * Требование не формальное: приоритетный сегмент проекта — школьники, и без
	 * согласия родителя нельзя ни обрабатывать их персональные данные, ни брать
	 * на полевые выезды (152-ФЗ, ст. 9).
	 *
	 * Экран намеренно объясняет, что курс при этом уже доступен. Иначе подросток
	 * читает «нужен документ от родителей» как «ничего сделать нельзя» и уходит
	 * — а мы теряем его на самом узком месте воронки ради бумаги, которая нужна
	 * только для следующего шага.
	 *
	 * Сама форма — общий компонент: тот же документ просят на шаге онбординга.
	 */
</script>

<svelte:head><title>Согласие представителя · Чистый берег</title></svelte:head>

<div class="h-full overflow-y-auto">
	<div class="mx-auto flex max-w-2xl flex-col gap-6 p-4 pb-16 sm:p-6">
		<header>
			<h1 class="text-xl font-semibold text-slate-900">Согласие законного представителя</h1>
			<p class="mt-1 text-sm text-slate-500">
				Участникам до 18 лет для работы с картой и выездов нужно согласие родителя или опекуна.
			</p>
		</header>

		<!-- Главное сообщение экрана: блокирована карта, а не обучение -->
		<div class="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm">
			<Info size={16} class="mt-0.5 shrink-0 text-sky-600" />
			<p class="text-sky-900">
				Курс доступен уже сейчас — начните обучение, пока родитель подписывает документ.
				<a href={resolve('/course')} class="font-medium underline">Перейти к обучению</a>
			</p>
		</div>

		<ConsentForm />
	</div>
</div>
