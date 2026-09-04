<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import RolePicker from '$lib/components/RolePicker.svelte';
	import { session } from '$lib/state/session.svelte';
	import type { Role } from '$lib/types';

	let email = $state('');
	let password = $state('');
	let role = $state<Role>('volunteer');

	const ready = $derived(email.includes('@') && password.length >= 6);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!ready) return;
		session.login(email.trim(), role);
		goto(resolve('/map'));
	}
</script>

<svelte:head><title>Вход · Чистый берег</title></svelte:head>

<AuthShell>
	<div>
		<h1 class="text-2xl font-semibold text-slate-900">Вход</h1>
		<p class="mt-1 text-sm text-slate-500">Прототип: пароль не проверяется.</p>
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
				class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
			/>
		</label>

		<label class="flex flex-col gap-1 text-xs text-slate-500">
			Пароль
			<input
				bind:value={password}
				type="password"
				required
				autocomplete="current-password"
				class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
			/>
			<span class="text-slate-400">От 6 символов.</span>
		</label>

		<RolePicker bind:role />

		<button
			type="submit"
			disabled={!ready}
			class="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400"
		>
			Войти
		</button>
	</form>

	<p class="text-sm text-slate-500">
		Впервые здесь?
		<a href={resolve('/register')} class="font-medium text-slate-900 underline"
			>Зарегистрироваться</a
		>
	</p>
</AuthShell>
