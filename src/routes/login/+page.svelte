<script lang="ts">
	import { TriangleAlert } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { session } from '$lib/state/session.svelte';

	let email = $state('');
	let password = $state('');

	// Роль больше не выбирается на входе: она приходит с сервера вместе с
	// профилем. Дать выбрать её здесь означало бы позволить назваться кем
	// угодно — раньше так и было, потому что сервера не было вовсе.
	const ready = $derived(email.includes('@') && password.length >= 8);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!ready || session.busy) return;
		if (await session.login(email.trim(), password)) goto(resolve(session.landingPath));
	}
</script>

<svelte:head><title>Вход · Чистый берег</title></svelte:head>

<AuthShell>
	<div class="flex items-center gap-3">
		<Logo size={44} />
		<div>
			<h1 class="text-2xl font-semibold text-slate-900">Вход</h1>
			<p class="mt-0.5 text-sm text-slate-500">Чистый берег</p>
		</div>
	</div>

	<form class="flex flex-col gap-4" onsubmit={submit}>
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
				autocomplete="current-password"
				class="min-h-12 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
			/>
			<span class="text-slate-400">От 8 символов.</span>
		</label>

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
			{session.busy ? 'Входим…' : 'Войти'}
		</button>
	</form>

	<p class="text-sm text-slate-500">
		Нет аккаунта?
		<a href={resolve('/register')} class="font-medium text-slate-900 underline"
			>Зарегистрироваться</a
		>
	</p>
</AuthShell>
