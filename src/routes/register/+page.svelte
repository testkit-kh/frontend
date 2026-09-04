<script lang="ts">
	import { CircleAlert, Info } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import RolePicker from '$lib/components/RolePicker.svelte';
	import { session } from '$lib/state/session.svelte';
	import { validateCadastral, validateInn } from '$lib/registry';
	import type { Role } from '$lib/types';

	let role = $state<Role>('volunteer');
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let birth = $state('');

	let org = $state('');
	let inn = $state('');
	let cadastral = $state('');

	const AGE_LIMIT = 14;

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

	const tooYoung = $derived(age !== null && age < AGE_LIMIT);

	const innValid = $derived(inn.trim() === '' || validateInn(inn));
	const cadastralValid = $derived(cadastral.trim() === '' || validateCadastral(cadastral));

	const base = $derived(name.trim().length > 1 && email.includes('@') && password.length >= 6);
	const ready = $derived(
		base &&
			(role === 'volunteer'
				? Boolean(birth) && !tooYoung
				: org.trim().length > 1 && validateInn(inn) && validateCadastral(cadastral))
	);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!ready) return;
		session.register(name, email.trim(), role);
		goto(resolve('/map'));
	}
</script>

<svelte:head><title>Регистрация · Чистый берег</title></svelte:head>

<AuthShell>
	<div>
		<h1 class="text-2xl font-semibold text-slate-900">Регистрация</h1>
		<p class="mt-1 text-sm text-slate-500">Займёт минуту. Обучение — следующим шагом.</p>
	</div>

	<form class="flex flex-col gap-4" onsubmit={submit}>
		<RolePicker bind:role />

		<label class="flex flex-col gap-1 text-xs text-slate-500">
			ФИО
			<input
				bind:value={name}
				required
				placeholder="Иванова Мария"
				class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
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
				class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
			/>
		</label>

		<label class="flex flex-col gap-1 text-xs text-slate-500">
			Пароль
			<input
				bind:value={password}
				type="password"
				required
				autocomplete="new-password"
				class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
			/>
			<span class="text-slate-400">От 6 символов.</span>
		</label>

		{#if role === 'volunteer'}
			<label class="flex flex-col gap-1 text-xs text-slate-500">
				Дата рождения
				<input
					bind:value={birth}
					type="date"
					required
					class="rounded-lg border px-3 py-2 text-sm text-slate-900 {tooYoung
						? 'border-amber-300'
						: 'border-slate-300'}"
				/>
				{#if tooYoung}
					<span class="flex items-center gap-1.5 text-amber-700">
						<CircleAlert size={13} /> Самостоятельное участие с {AGE_LIMIT} лет. Напишите нам — подберём
						формат со школой.
					</span>
				{/if}
			</label>
		{:else}
			<label class="flex flex-col gap-1 text-xs text-slate-500">
				Название организации
				<input
					bind:value={org}
					required
					placeholder="Заповедник «Утриш»"
					class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
				/>
			</label>

			<label class="flex flex-col gap-1 text-xs text-slate-500">
				ИНН
				<input
					bind:value={inn}
					inputmode="numeric"
					required
					placeholder="7707083893"
					class="rounded-lg border px-3 py-2 text-sm text-slate-900 {innValid
						? 'border-slate-300'
						: 'border-amber-300'}"
				/>
				{#if !innValid}
					<span class="flex items-center gap-1.5 text-amber-700">
						<CircleAlert size={13} /> Контрольная сумма не сходится — проверьте цифры.
					</span>
				{/if}
			</label>

			<label class="flex flex-col gap-1 text-xs text-slate-500">
				Кадастровый номер территории
				<input
					bind:value={cadastral}
					required
					placeholder="23:37:0000000:1"
					class="rounded-lg border px-3 py-2 text-sm text-slate-900 {cadastralValid
						? 'border-slate-300'
						: 'border-amber-300'}"
				/>
				{#if !cadastralValid}
					<span class="flex items-center gap-1.5 text-amber-700">
						<CircleAlert size={13} /> Формат: 23:37:0000000:1
					</span>
				{/if}
			</label>

			<div
				class="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600"
			>
				<Info size={16} class="mt-0.5 shrink-0 text-slate-400" />
				<p>
					Реквизиты проверит система, границы территории построим по кадастровому номеру. Если
					автоматика не сработает, заявку посмотрит модератор — до этого предложка будет пустой.
				</p>
			</div>
		{/if}

		<button
			type="submit"
			disabled={!ready}
			class="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400"
		>
			Создать аккаунт
		</button>
	</form>

	<p class="text-sm text-slate-500">
		Уже есть аккаунт?
		<a href={resolve('/login')} class="font-medium text-slate-900 underline">Войти</a>
	</p>
</AuthShell>
