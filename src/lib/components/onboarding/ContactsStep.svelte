<script lang="ts">
	import { Building2, TriangleAlert } from '@lucide/svelte';
	import { ApiError } from '$lib/api/client';
	import { organizations } from '$lib/api/endpoints';

	/**
	 * Контакты ООПТ — второй шаг онбординга организации.
	 *
	 * Волонтёру некуда написать, если у ООПТ нет ни почты, ни телефона, а
	 * координатору нечего проверять при верификации. Название и ИНН здесь не
	 * трогаем: они канонические, взяты из ЕГРЮЛ, и правка руками означала бы
	 * разойтись с реестром — бэкенд их в PATCH и не принимает.
	 */

	let { oncomplete }: { oncomplete?: () => void } = $props();

	let email = $state('');
	let phone = $state('');
	let description = $state('');
	let saving = $state(false);
	let error = $state<string | null>(null);

	// Профиль уже мог быть заполнен — подставляем, чтобы человек не набирал
	// заново то, что и так есть на сервере.
	$effect(() => {
		organizations
			.me()
			.then((org) => {
				email = org.contact_email ?? '';
				phone = org.contact_phone ?? '';
				description = org.description ?? '';
			})
			.catch(() => {});
	});

	async function save() {
		if (saving) return;
		saving = true;
		error = null;
		try {
			await organizations.updateMe({
				contact_email: email.trim() || null,
				contact_phone: phone.trim() || null,
				description: description.trim() || null
			});
			oncomplete?.();
		} catch (cause) {
			error = cause instanceof ApiError ? cause.message : 'Не удалось сохранить';
		} finally {
			saving = false;
		}
	}
</script>

<div class="flex flex-col gap-5">
	<header class="flex items-start gap-3">
		<Building2 size={22} class="mt-0.5 shrink-0 text-slate-400" />
		<div>
			<h2 class="text-lg font-semibold text-slate-900">Контакты организации</h2>
			<p class="mt-1 text-sm text-slate-500">
				По ним с вами свяжутся волонтёры и координатор программы при проверке заявки.
			</p>
		</div>
	</header>

	<label class="flex flex-col gap-1 text-xs text-slate-500">
		Почта для обращений
		<input
			bind:value={email}
			type="email"
			placeholder="info@kronoki.ru"
			class="min-h-12 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
		/>
	</label>

	<label class="flex flex-col gap-1 text-xs text-slate-500">
		Телефон
		<input
			bind:value={phone}
			type="tel"
			inputmode="tel"
			placeholder="+7 415 000-00-00"
			class="min-h-12 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
		/>
	</label>

	<label class="flex flex-col gap-1 text-xs text-slate-500">
		Коротко о территории
		<textarea
			bind:value={description}
			rows="3"
			placeholder="Площадь, охраняемые виды, что важно знать волонтёру перед выездом"
			class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"></textarea>
	</label>

	{#if error}
		<p class="flex items-start gap-1.5 text-xs text-red-700">
			<TriangleAlert size={13} class="mt-0.5 shrink-0" />{error}
		</p>
	{/if}

	<button
		type="button"
		onclick={save}
		disabled={saving}
		class="min-h-12 rounded-full bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400"
	>
		{saving ? 'Сохраняем…' : 'Сохранить и продолжить'}
	</button>
</div>
