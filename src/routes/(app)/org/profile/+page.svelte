<script lang="ts">
	import { ApiError } from '$lib/api/client';
	import { organizations, type OrganizationProfile } from '$lib/api/endpoints';
	import StatusPill from '$lib/components/StatusPill.svelte';

	const VERIFICATION_LABEL = {
		pending: 'Ожидает проверки',
		verified: 'Подтверждена',
		failed: 'Отклонена',
		manual_review: 'На ручной проверке'
	};

	let profile = $state<OrganizationProfile | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let saved = $state(false);
	let busy = $state(false);

	let contactEmail = $state('');
	let contactPhone = $state('');
	let description = $state('');

	async function load() {
		loading = true;
		error = null;
		try {
			profile = await organizations.me();
			contactEmail = profile.contact_email ?? '';
			contactPhone = profile.contact_phone ?? '';
			description = profile.description ?? '';
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось загрузить профиль';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	async function save() {
		busy = true;
		error = null;
		saved = false;
		try {
			profile = await organizations.updateMe({
				contact_email: contactEmail.trim() || null,
				contact_phone: contactPhone.trim() || null,
				description: description.trim() || null
			});
			saved = true;
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось сохранить';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Профиль организации · Кабинет ООПТ</title></svelte:head>

<div class="flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
	<h2 class="text-lg font-semibold text-slate-900">Профиль организации</h2>

	{#if loading}
		<p class="text-sm text-slate-500">Загружаем…</p>
	{:else if error && !profile}
		<p class="text-sm text-red-700">{error}</p>
	{:else if profile}
		<div class="rounded-lg border border-slate-200 bg-white p-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p class="text-base font-medium text-slate-900">{profile.name}</p>
					<p class="text-xs text-slate-500">ИНН {profile.inn}</p>
				</div>
				<StatusPill
					label={VERIFICATION_LABEL[profile.verification_status]}
					tone={profile.verification_status === 'verified'
						? 'positive'
						: profile.verification_status === 'failed'
							? 'negative'
							: 'warning'}
				/>
			</div>
			<p class="mt-3 text-xs text-slate-500">
				Название и ИНН — из ЕГРЮЛ, редактируются только через реестр.
			</p>
		</div>

		<div class="grid grid-cols-2 gap-3 text-sm">
			<div class="rounded-lg border border-slate-200 bg-white p-4">
				<p class="text-xs text-slate-500">Участков</p>
				<p class="text-xl font-semibold text-slate-900">{profile.parcels_count}</p>
			</div>
			<div class="rounded-lg border border-slate-200 bg-white p-4">
				<p class="text-xs text-slate-500">Площадок наблюдений</p>
				<p class="text-xl font-semibold text-slate-900">{profile.monitoring_sites_count}</p>
			</div>
		</div>

		<div>
			<h3 class="mb-2 text-sm font-medium text-slate-700">Сотрудники</h3>
			<ul class="flex flex-col gap-2">
				{#each profile.staff_members as member (member.id)}
					<li class="rounded-lg border border-slate-200 bg-white p-3 text-sm">
						<p class="font-medium text-slate-900">{member.full_name}</p>
						<p class="text-xs text-slate-500">{member.email}</p>
					</li>
				{/each}
			</ul>
		</div>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				save();
			}}
			class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4"
		>
			<h3 class="text-sm font-medium text-slate-700">Контактные данные</h3>
			<label class="flex flex-col gap-1 text-xs text-slate-500">
				Email
				<input
					type="email"
					bind:value={contactEmail}
					class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
				/>
			</label>
			<label class="flex flex-col gap-1 text-xs text-slate-500">
				Телефон
				<input
					bind:value={contactPhone}
					class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
				/>
			</label>
			<label class="flex flex-col gap-1 text-xs text-slate-500">
				Описание
				<textarea
					bind:value={description}
					rows="3"
					class="resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
				></textarea>
			</label>
			{#if error}<p class="text-sm text-red-700">{error}</p>{/if}
			{#if saved}<p class="text-sm text-emerald-700">Сохранено.</p>{/if}
			<button
				type="submit"
				disabled={busy}
				class="self-start rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
			>
				Сохранить
			</button>
		</form>
	{/if}
</div>
