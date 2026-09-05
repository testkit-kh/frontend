<script lang="ts">
	import { CircleCheck, Clock, Info, TriangleAlert } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { ApiError } from '$lib/api/client';
	import { consent } from '$lib/api/endpoints';
	import { session } from '$lib/state/session.svelte';

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
	 */

	let representativeName = $state('');
	let representativePhone = $state('');
	let representativeEmail = $state('');
	let relation = $state('мать');
	let scanUrl = $state('');

	let submitting = $state(false);
	let error = $state<string | null>(null);
	let submitted = $state(false);

	const RELATIONS = ['мать', 'отец', 'опекун', 'попечитель'];

	const ready = $derived(
		representativeName.trim().length > 2 &&
			representativePhone.replace(/\D/g, '').length >= 10 &&
			representativeEmail.includes('@')
	);

	const status = $derived(
		session.profile && 'consent_status' in session.profile
			? session.profile.consent_status
			: 'not_required'
	);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!ready || submitting) return;

		submitting = true;
		error = null;
		try {
			await consent.submit({
				representative_name: representativeName.trim(),
				representative_phone: representativePhone.trim(),
				representative_email: representativeEmail.trim(),
				relation,
				scan_url: scanUrl.trim() || null
			});
			submitted = true;
			await session.refresh();
		} catch (cause) {
			error = cause instanceof ApiError ? cause.message : 'Не удалось отправить';
		} finally {
			submitting = false;
		}
	}
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

		{#if status === 'approved'}
			<div
				class="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm"
			>
				<CircleCheck size={16} class="mt-0.5 shrink-0 text-emerald-600" />
				<p class="text-emerald-900">Согласие подтверждено. Работа с картой и выезды открыты.</p>
			</div>
		{:else if submitted || status === 'awaiting'}
			<div class="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
				<Clock size={16} class="mt-0.5 shrink-0 text-amber-500" />
				<div>
					<p class="font-medium text-slate-900">Документ отправлен</p>
					<p class="mt-0.5 text-slate-600">
						Координатор программы проверит его и пришлёт уведомление. Обычно это занимает один-два
						рабочих дня.
					</p>
				</div>
			</div>
		{/if}

		{#if status !== 'approved' && !submitted}
			<form class="flex flex-col gap-4" onsubmit={submit}>
				<label class="flex flex-col gap-1 text-xs text-slate-500">
					ФИО представителя
					<input
						bind:value={representativeName}
						required
						placeholder="Иванова Ольга Петровна"
						class="min-h-12 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
					/>
				</label>

				<label class="flex flex-col gap-1 text-xs text-slate-500">
					Кем приходится
					<select
						bind:value={relation}
						class="min-h-12 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
					>
						{#each RELATIONS as option (option)}
							<option value={option}>{option}</option>
						{/each}
					</select>
				</label>

				<label class="flex flex-col gap-1 text-xs text-slate-500">
					Телефон
					<input
						bind:value={representativePhone}
						type="tel"
						inputmode="tel"
						required
						placeholder="+7 900 000-00-00"
						class="min-h-12 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
					/>
				</label>

				<label class="flex flex-col gap-1 text-xs text-slate-500">
					Почта представителя
					<input
						bind:value={representativeEmail}
						type="email"
						required
						placeholder="mail@example.ru"
						class="min-h-12 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
					/>
					<span class="text-slate-400">На неё придёт подтверждение согласия.</span>
				</label>

				<label class="flex flex-col gap-1 text-xs text-slate-500">
					Ссылка на скан подписанного согласия
					<input
						bind:value={scanUrl}
						type="url"
						placeholder="https://…"
						class="min-h-12 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
					/>
					<span class="text-slate-400">
						Необязательно: можно отправить данные сейчас, а скан приложить позже. Загрузка файла
						появится вместе с хранилищем.
					</span>
				</label>

				{#if error}
					<div class="flex items-start gap-2 text-xs text-red-700">
						<TriangleAlert size={14} class="mt-0.5 shrink-0" />
						<span>{error}</span>
					</div>
				{/if}

				<button
					type="submit"
					disabled={!ready || submitting}
					class="min-h-12 rounded-full bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400"
				>
					{submitting ? 'Отправляем…' : 'Отправить согласие'}
				</button>

				<p class="text-xs text-slate-400">
					Данные представителя используются только для подтверждения согласия и не публикуются.
				</p>
			</form>
		{/if}
	</div>
</div>
