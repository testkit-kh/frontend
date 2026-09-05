<script lang="ts">
	import { CircleCheck, Clock, TriangleAlert } from '@lucide/svelte';
	import { ApiError } from '$lib/api/client';
	import { consent } from '$lib/api/endpoints';
	import { uploads } from '$lib/api/uploads';
	import { session } from '$lib/state/session.svelte';

	/**
	 * Форма согласия законного представителя (14–17 лет).
	 *
	 * Вынесена из `/consent` отдельным компонентом: тот же документ просят на
	 * шаге онбординга сразу после регистрации. Две копии формы разъехались бы
	 * на первой же правке — а расходиться им нельзя, это юридический документ
	 * (152-ФЗ, ст. 9), а не украшение.
	 */

	let { onsubmitted }: { onsubmitted?: () => void } = $props();

	let representativeName = $state('');
	let representativePhone = $state('');
	let representativeEmail = $state('');
	let relation = $state('мать');
	let scanUrl = $state('');
	let scanFile = $state<File | null>(null);

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
			let url = scanUrl.trim() || null;
			if (scanFile) {
				url = await uploads.putFile(scanFile, 'consent_scan');
			}
			await consent.submit({
				representative_name: representativeName.trim(),
				representative_phone: representativePhone.trim(),
				representative_email: representativeEmail.trim(),
				relation,
				scan_url: url
			});
			submitted = true;
			await session.refresh();
			onsubmitted?.();
		} catch (cause) {
			error = cause instanceof ApiError ? cause.message : 'Не удалось отправить';
		} finally {
			submitting = false;
		}
	}
</script>

{#if status === 'approved'}
	<div
		class="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm"
	>
		<CircleCheck size={16} class="mt-0.5 shrink-0 text-emerald-600" />
		<p class="text-emerald-900">Согласие подтверждено. Работа с картой и выезды открыты.</p>
	</div>
{:else if submitted}
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
{:else if status === 'rejected'}
	<div class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
		<TriangleAlert size={16} class="mt-0.5 shrink-0 text-amber-600" />
		<p class="text-amber-900">
			Прошлое согласие отклонено координатором. Проверьте данные представителя и отправьте заново.
		</p>
	</div>
{/if}
<!-- Про `awaiting` здесь намеренно ничего не написано: этот статус означает
     «человеку нет 18 и согласие не подтверждено», и он стоит с самой
     регистрации. Раньше по нему показывалось «Документ отправлен» — то есть
     подросток видел, что бумага уже у координатора, хотя никто ничего не
     отправлял, и спокойно ждал решения, которого не будет. -->

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
			Скан согласия — файл или ссылка
			<input
				type="file"
				accept="application/pdf,image/*"
				onchange={(event) => (scanFile = event.currentTarget.files?.[0] ?? null)}
				class="text-xs text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
			/>
			<input
				bind:value={scanUrl}
				type="url"
				placeholder="или https://…"
				class="min-h-12 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
			/>
			<span class="text-slate-400"
				>Необязательно: можно отправить данные сейчас, а скан — позже.</span
			>
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
			Данные представителя используются только для подтверждения согласия и не публикуются. Если
			документ уже отправляли, повторная отправка обновит данные — координатор увидит последнюю.
		</p>
	</form>
{/if}
