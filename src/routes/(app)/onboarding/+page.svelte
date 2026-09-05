<script lang="ts">
	import { ArrowRight, Check } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ConsentForm from '$lib/components/ConsentForm.svelte';
	import ContactsStep from '$lib/components/onboarding/ContactsStep.svelte';
	import EducationStep from '$lib/components/onboarding/EducationStep.svelte';
	import TerritoryStep from '$lib/components/onboarding/TerritoryStep.svelte';
	import { session } from '$lib/state/session.svelte';
	import { onboardingState } from '$lib/state/onboarding.svelte';

	/**
	 * Онбординг — то, что происходит между «аккаунт создан» и первым полезным
	 * действием.
	 *
	 * Раньше регистрация вела сразу на курс (волонтёр) или в пустой кабинет
	 * (ООПТ), и всё, что нужно знать о человеке, спрашивалось потом — то есть
	 * никогда. Здесь мы собираем это ровно один раз и в том порядке, в каком
	 * оно нужно воронке:
	 *
	 *   волонтёр:  образование → согласие представителя (14–17) → курс
	 *   ООПТ:      границы территории → контакты → кабинет
	 *
	 * Согласие стоит перед курсом, но курс им не блокируется: обучение открыто
	 * сразу, а документ нужен только для карты и выездов. Это принципиально —
	 * подросток, упёршийся в «нужна бумага от родителей», из воронки уходит.
	 */

	type StepId = 'education' | 'consent' | 'territory' | 'contacts';

	const isStaff = $derived(session.isStaff);

	const steps = $derived.by<Array<{ id: StepId; label: string }>>(() => {
		if (isStaff) {
			return [
				{ id: 'territory', label: 'Территория' },
				{ id: 'contacts', label: 'Контакты' }
			];
		}
		return [
			{ id: 'education', label: 'Образование' },
			...(session.needsConsent ? [{ id: 'consent' as StepId, label: 'Согласие' }] : [])
		];
	});

	let index = $state(0);
	const current = $derived(steps[Math.min(index, steps.length - 1)]);
	const last = $derived(index >= steps.length - 1);

	/** Куда ведём после последнего шага: волонтёра — учиться, ООПТ — в кабинет. */
	const exitPath = $derived(isStaff ? '/org' : '/course');

	function next() {
		if (!last) {
			index += 1;
			return;
		}
		finish();
	}

	function finish() {
		onboardingState.finish();
		goto(resolve(exitPath as '/org' | '/course'), { replaceState: true });
	}
</script>

<svelte:head><title>Знакомимся · Чистый берег</title></svelte:head>

<div class="h-full overflow-y-auto">
	<div class="mx-auto flex max-w-2xl flex-col gap-6 p-4 pb-16 sm:p-6">
		<header>
			<h1 class="text-xl font-semibold text-slate-900">
				{isStaff ? 'Настроим кабинет ООПТ' : 'Пара вопросов перед обучением'}
			</h1>
			<p class="mt-1 text-sm text-slate-500">
				{isStaff
					? 'Два шага: границы территории и контакты. Их видит координатор при проверке заявки.'
					: 'Займёт минуту. Потом — курс, и после проверки сертификата откроется карта.'}
			</p>
		</header>

		<!-- Прогресс: человек должен видеть, сколько ещё осталось, иначе форма
		     без конца выглядит длиннее, чем есть. -->
		<ol class="flex items-center gap-2">
			{#each steps as step, i (step.id)}
				<li class="flex items-center gap-2">
					<span
						class="flex size-6 items-center justify-center rounded-full text-xs {i < index
							? 'bg-emerald-600 text-white'
							: i === index
								? 'bg-slate-900 text-white'
								: 'bg-slate-200 text-slate-500'}"
					>
						{#if i < index}<Check size={13} />{:else}{i + 1}{/if}
					</span>
					<span class="text-xs {i === index ? 'text-slate-900' : 'text-slate-400'}">
						{step.label}
					</span>
					{#if i < steps.length - 1}
						<ArrowRight size={13} class="text-slate-300" />
					{/if}
				</li>
			{/each}
		</ol>

		<div class="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
			{#if current?.id === 'education'}
				<EducationStep oncomplete={next} />
			{:else if current?.id === 'consent'}
				<div class="flex flex-col gap-4">
					<header>
						<h2 class="text-lg font-semibold text-slate-900">Согласие представителя</h2>
						<p class="mt-1 text-sm text-slate-500">
							Вам ещё нет 18, поэтому для карты и выездов нужен документ от родителя или опекуна.
							Обучение открыто уже сейчас — можно заполнить это позже.
						</p>
					</header>
					<ConsentForm onsubmitted={next} />
				</div>
			{:else if current?.id === 'territory'}
				<TerritoryStep oncomplete={next} />
			{:else if current?.id === 'contacts'}
				<ContactsStep oncomplete={next} />
			{/if}
		</div>

		<!-- Пропуск есть всегда и виден. Анкета, из которой нельзя выйти, даёт
		     не данные, а брошенные регистрации. -->
		<button
			type="button"
			onclick={finish}
			class="self-start text-sm text-slate-500 underline hover:text-slate-900"
		>
			{isStaff ? 'Заполнить позже — в кабинет' : 'Пропустить и перейти к обучению'}
		</button>

		{#if onboardingState.pendingSync}
			<p class="text-xs text-slate-400">
				Анкета сохранена на этом устройстве и отправится на сервер, когда появится ручка приёма.
			</p>
		{/if}
	</div>
</div>
