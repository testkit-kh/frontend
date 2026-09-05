<script lang="ts">
	import { CircleAlert, CircleCheck, Info, Loader2, TriangleAlert } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ApiError } from '$lib/api/client';
	import { registry, type CompanyInfo } from '$lib/api/endpoints';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import RolePicker from '$lib/components/RolePicker.svelte';
	import { session } from '$lib/state/session.svelte';
	import { validateInn } from '$lib/registry';
	import type { Role } from '$lib/types';

	let role = $state<Role>('volunteer');
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let birth = $state('');
	let org = $state('');
	let inn = $state('');

	const MIN_AGE = 14;
	const ADULT_AGE = 18;

	const age = $derived.by(() => {
		if (!birth) return null;
		const born = new Date(birth);
		if (Number.isNaN(born.valueOf())) return null;
		const now = new Date();
		let years = now.getFullYear() - born.getFullYear();
		const beforeBirthday =
			now.getMonth() < born.getMonth() ||
			(now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
		if (beforeBirthday) years -= 1;
		return years;
	});

	const tooYoung = $derived(age !== null && age < MIN_AGE);
	const needsConsent = $derived(age !== null && age >= MIN_AGE && age < ADULT_AGE);
	const innValid = $derived(inn.trim() === '' || validateInn(inn));

	// ── Автозаполнение по ИНН ────────────────────────────────────────────
	// Ходим в ЕГРЮЛ, когда контрольная сумма сошлась: гонять запрос на каждое
	// нажатие клавиши бессмысленно, а битый ИНН реестр всё равно не найдёт.
	let company = $state<CompanyInfo | null>(null);
	let lookingUp = $state(false);
	let lookupNote = $state<string | null>(null);
	let controller: AbortController | null = null;

	async function lookupCompany(value: string) {
		controller?.abort();
		company = null;
		lookupNote = null;
		if (!validateInn(value)) return;

		controller = new AbortController();
		lookingUp = true;
		try {
			company = await registry.company(value.replace(/\D/g, ''), controller.signal);
			org = company.short_name ?? company.name;
			if (!company.is_active) {
				lookupNote = 'По данным ЕГРЮЛ организация недействующая — заявку проверит модератор.';
			}
		} catch (error) {
			if (error instanceof ApiError) {
				// Реестр недоступен — это не повод не пустить человека: бэкенд
				// в таком случае отправит заявку на ручную проверку.
				lookupNote = error.isUnavailable
					? 'Реестр сейчас недоступен — заполните название вручную.'
					: error.message;
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
		lookupCompany(value);
	});

	const ready = $derived(
		name.trim().length > 1 &&
			email.includes('@') &&
			password.length >= 8 &&
			(role === 'volunteer'
				? Boolean(birth) && !tooYoung
				: org.trim().length > 1 && validateInn(inn))
	);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!ready || session.busy) return;

		const success =
			role === 'volunteer'
				? await session.registerVolunteer({
						email: email.trim(),
						password,
						full_name: name.trim(),
						birth_date: birth,
						is_over_14: true,
						source: 'direct'
					})
				: await session.registerOrganization({
						org_name: org.trim(),
						inn: inn.replace(/\D/g, ''),
						email: email.trim(),
						password,
						full_name: name.trim()
					});

		if (!success) return;
		// Дальше решает роль: волонтёра встретит гвард в layout (согласие,
		// обучение или карта), сотрудника — сразу кабинет ООПТ.
		goto(resolve(session.landingPath));
	}
</script>

<svelte:head><title>Регистрация · Чистый берег</title></svelte:head>

<AuthShell>
	<div class="flex items-center gap-3">
		<Logo size={44} />
		<div>
			<h1 class="text-2xl font-semibold text-slate-900">Регистрация</h1>
			<p class="mt-0.5 text-sm text-slate-500">Займёт минуту. Обучение — следующим шагом.</p>
		</div>
	</div>

	<form class="flex flex-col gap-4" onsubmit={submit}>
		<RolePicker bind:role />

		<label class="flex flex-col gap-1 text-xs text-slate-500">
			ФИО
			<input
				bind:value={name}
				required
				placeholder="Иванова Мария"
				class="min-h-12 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
			/>
		</label>

		<label class="flex flex-col gap-1 text-xs text-slate-500">
			Почта
			<input
				bind:value={email}
				type="email"
				required
				autocomplete="email"
				placeholder="mail@example.ru"
				class="min-h-12 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
			/>
		</label>

		<label class="flex flex-col gap-1 text-xs text-slate-500">
			Пароль
			<input
				bind:value={password}
				type="password"
				required
				autocomplete="new-password"
				class="min-h-12 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
			/>
			<span class="text-slate-400">От 8 символов.</span>
		</label>

		{#if role === 'volunteer'}
			<label class="flex flex-col gap-1 text-xs text-slate-500">
				Дата рождения
				<input
					bind:value={birth}
					type="date"
					required
					class="min-h-12 rounded-lg border px-3 text-sm text-slate-900 {tooYoung
						? 'border-amber-300'
						: 'border-slate-300'}"
				/>
				{#if tooYoung}
					<span class="flex items-start gap-1.5 text-amber-700">
						<CircleAlert size={13} class="mt-0.5 shrink-0" />
						Самостоятельное участие с {MIN_AGE} лет. Напишите нам — подберём формат со школой.
					</span>
				{:else if needsConsent}
					<!-- Говорим об этом до отправки формы, а не после: человек должен
					     понимать, что его ждёт, и что курс при этом уже открыт. -->
					<span class="flex items-start gap-1.5 text-slate-500">
						<Info size={13} class="mt-0.5 shrink-0" />
						До 18 лет понадобится согласие родителя — попросим его на следующем шаге. Обучение доступно
						сразу.
					</span>
				{/if}
			</label>
		{:else}
			<label class="flex flex-col gap-1 text-xs text-slate-500">
				ИНН организации
				<input
					bind:value={inn}
					inputmode="numeric"
					required
					placeholder="4101124158"
					class="min-h-12 rounded-lg border px-3 text-sm text-slate-900 {innValid
						? 'border-slate-300'
						: 'border-amber-300'}"
				/>
				{#if !innValid}
					<span class="flex items-center gap-1.5 text-amber-700">
						<CircleAlert size={13} /> Контрольная сумма не сходится — проверьте цифры.
					</span>
				{:else if lookingUp}
					<span class="flex items-center gap-1.5 text-slate-400">
						<Loader2 size={13} class="animate-spin" /> Ищем в ЕГРЮЛ…
					</span>
				{:else if company}
					<span class="flex items-start gap-1.5 text-emerald-700">
						<CircleCheck size={13} class="mt-0.5 shrink-0" />
						{company.name}{company.ogrn ? ` · ОГРН ${company.ogrn}` : ''}
					</span>
				{/if}
				{#if lookupNote}
					<span class="flex items-start gap-1.5 text-amber-700">
						<TriangleAlert size={13} class="mt-0.5 shrink-0" />{lookupNote}
					</span>
				{/if}
			</label>

			<label class="flex flex-col gap-1 text-xs text-slate-500">
				Название организации
				<input
					bind:value={org}
					required
					placeholder="Кроноцкий заповедник"
					class="min-h-12 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
				/>
				<span class="text-slate-400">
					Подставляется из реестра, можно поправить. Кадастровые участки территории добавите в
					профиле организации.
				</span>
			</label>
		{/if}

		{#if session.error}
			<div class="flex items-start gap-2 text-xs text-red-700">
				<TriangleAlert size={14} class="mt-0.5 shrink-0" />
				<span>{session.error}</span>
			</div>
		{/if}

		<button
			type="submit"
			disabled={!ready || session.busy}
			class="min-h-12 rounded-full bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400"
		>
			{session.busy ? 'Создаём…' : 'Создать аккаунт'}
		</button>
	</form>

	<p class="text-sm text-slate-500">
		Уже есть аккаунт?
		<a href={resolve('/login')} class="font-medium text-slate-900 underline">Войти</a>
	</p>
</AuthShell>
