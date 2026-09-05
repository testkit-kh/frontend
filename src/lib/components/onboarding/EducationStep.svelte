<script lang="ts">
	import { CircleCheck, GraduationCap, Loader2, TriangleAlert } from '@lucide/svelte';
	import { ApiError } from '$lib/api/client';
	import { registry, type CompanyInfo } from '$lib/api/endpoints';
	import type { EducationLevel } from '$lib/api/onboarding';
	import { onboardingState } from '$lib/state/onboarding.svelte';
	import { validateInn } from '$lib/registry';

	/**
	 * Шаг «где вы учитесь» — между регистрацией и курсом.
	 *
	 * Зачем спрашиваем: школьники и студенты — приоритетный сегмент программы,
	 * и от учебного заведения зависят и групповые выезды, и отчётность перед
	 * ООПТ («сколько школ участвует»), и канал привлечения в KPI. Спрашивать
	 * это после курса поздно: к тому моменту человек уже ушёл на iSpring.
	 *
	 * Учреждение ищем по ИНН — тем же способом и той же ручкой, что и ООПТ при
	 * регистрации: школы, колледжи и вузы — юрлица в ЕГРЮЛ. Это бесплатно, без
	 * ключей и лимитов, и избавляет от свалки в поле «название школы», где одна
	 * и та же гимназия пишется семью способами.
	 *
	 * Всё, кроме уровня, необязательно: анкета не должна становиться забором
	 * перед обучением.
	 */

	let { oncomplete }: { oncomplete?: () => void } = $props();

	const LEVELS: Array<{ value: EducationLevel; label: string; hint: string }> = [
		{ value: 'school', label: 'Школа', hint: 'класс' },
		{ value: 'college', label: 'Колледж, техникум', hint: 'курс' },
		{ value: 'university', label: 'Вуз', hint: 'курс' },
		{ value: 'working', label: 'Работаю', hint: '' },
		{ value: 'other', label: 'Другое', hint: '' }
	];

	const saved = onboardingState.education;

	let level = $state<EducationLevel>((saved?.level as EducationLevel) ?? 'school');
	let inn = $state(saved?.institution_inn ?? '');
	let institution = $state(saved?.institution_name ?? '');
	let grade = $state(saved?.grade ?? '');
	let city = $state(saved?.city ?? '');
	let saving = $state(false);

	const studies = $derived(level === 'school' || level === 'college' || level === 'university');
	const gradeLabel = $derived(LEVELS.find((l) => l.value === level)?.hint ?? '');
	const innValid = $derived(inn.trim() === '' || validateInn(inn));

	// ── Поиск учреждения по ИНН ──────────────────────────────────────────
	// Логика повторяет форму регистрации ООПТ: запрос уходит, только когда
	// контрольная сумма сошлась — битый ИНН реестр всё равно не найдёт.
	let company = $state<CompanyInfo | null>(null);
	let lookingUp = $state(false);
	let lookupNote = $state<string | null>(null);
	let controller: AbortController | null = null;

	async function lookup(value: string) {
		controller?.abort();
		company = null;
		lookupNote = null;
		if (!validateInn(value)) return;

		controller = new AbortController();
		lookingUp = true;
		try {
			company = await registry.company(value.replace(/\D/g, ''), controller.signal);
			institution = company.short_name ?? company.name;
		} catch (error) {
			if (error instanceof ApiError) {
				lookupNote = error.isUnavailable
					? 'Реестр сейчас недоступен — впишите название вручную.'
					: 'По этому ИНН ничего не нашлось — впишите название вручную.';
			}
		} finally {
			lookingUp = false;
		}
	}

	let lastInn = '';
	$effect(() => {
		const value = inn.trim();
		if (value === lastInn) return;
		lastInn = value;
		lookup(value);
	});

	async function save() {
		if (saving) return;
		saving = true;
		try {
			await onboardingState.saveEducation({
				level,
				institution_name: institution.trim() || null,
				institution_inn: inn.replace(/\D/g, '') || null,
				grade: grade.trim() || null,
				city: city.trim() || null
			});
			oncomplete?.();
		} finally {
			saving = false;
		}
	}
</script>

<div class="flex flex-col gap-5">
	<header class="flex items-start gap-3">
		<GraduationCap size={22} class="mt-0.5 shrink-0 text-slate-400" />
		<div>
			<h2 class="text-lg font-semibold text-slate-900">Где вы учитесь</h2>
			<p class="mt-1 text-sm text-slate-500">
				Нужно, чтобы собирать группы по школам и считать участие учебных заведений. Кроме первого
				пункта — всё по желанию.
			</p>
		</div>
	</header>

	<fieldset class="flex flex-col gap-2">
		<legend class="mb-1 text-xs text-slate-500">Сейчас вы</legend>
		<div class="flex flex-wrap gap-2">
			{#each LEVELS as option (option.value)}
				<button
					type="button"
					onclick={() => (level = option.value)}
					class="min-h-11 rounded-full border px-4 text-sm {level === option.value
						? 'border-slate-900 bg-slate-900 text-white'
						: 'border-slate-300 text-slate-700 hover:bg-slate-50'}"
				>
					{option.label}
				</button>
			{/each}
		</div>
	</fieldset>

	{#if studies}
		<label class="flex flex-col gap-1 text-xs text-slate-500">
			ИНН учебного заведения
			<input
				bind:value={inn}
				inputmode="numeric"
				placeholder="4101012345"
				class="min-h-12 rounded-lg border px-3 text-sm text-slate-900 {innValid
					? 'border-slate-300'
					: 'border-amber-300'}"
			/>
			{#if !innValid}
				<span class="text-amber-700">Контрольная сумма не сходится — проверьте цифры.</span>
			{:else if lookingUp}
				<span class="flex items-center gap-1.5 text-slate-400">
					<Loader2 size={13} class="animate-spin" /> Ищем в ЕГРЮЛ…
				</span>
			{:else if company}
				<span class="flex items-start gap-1.5 text-emerald-700">
					<CircleCheck size={13} class="mt-0.5 shrink-0" />{company.name}
				</span>
			{:else}
				<span class="text-slate-400">
					Можно не заполнять — тогда впишите название заведения ниже руками.
				</span>
			{/if}
			{#if lookupNote}
				<span class="flex items-start gap-1.5 text-amber-700">
					<TriangleAlert size={13} class="mt-0.5 shrink-0" />{lookupNote}
				</span>
			{/if}
		</label>

		<label class="flex flex-col gap-1 text-xs text-slate-500">
			Название заведения
			<input
				bind:value={institution}
				placeholder="Гимназия № 39, Петропавловск-Камчатский"
				class="min-h-12 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
			/>
		</label>

		<label class="flex flex-col gap-1 text-xs text-slate-500">
			{gradeLabel === 'класс' ? 'Класс' : 'Курс'}
			<input
				bind:value={grade}
				inputmode="numeric"
				placeholder={gradeLabel === 'класс' ? '9' : '2'}
				class="min-h-12 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
			/>
		</label>
	{/if}

	<label class="flex flex-col gap-1 text-xs text-slate-500">
		Город
		<input
			bind:value={city}
			placeholder="Петропавловск-Камчатский"
			class="min-h-12 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
		/>
	</label>

	<button
		type="button"
		onclick={save}
		disabled={saving}
		class="min-h-12 rounded-full bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400"
	>
		{saving ? 'Сохраняем…' : 'Сохранить и продолжить'}
	</button>
</div>
