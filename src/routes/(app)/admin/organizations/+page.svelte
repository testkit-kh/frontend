<script lang="ts">
	import { Check, X } from '@lucide/svelte';
	import { ApiError } from '$lib/api/client';
	import { organizations, type OrganizationListItem, type Schemas } from '$lib/api/endpoints';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { formatDate } from '$lib/format';

	const VERIFICATION_LABEL = {
		pending: 'Ожидает проверки',
		verified: 'Подтверждена',
		failed: 'Отклонена',
		manual_review: 'На ручной проверке'
	};

	// По умолчанию — то, что реально требует внимания координатора: сбой
	// автоматической проверки по ИНН уводит организацию в manual_review, а не
	// в отказ, и разобрать эту очередь до сих пор было некому.
	let filter = $state<Schemas['OrgVerificationStatus'] | 'all'>('manual_review');
	let items = $state<OrganizationListItem[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let busyId = $state<string | null>(null);
	let reasonDrafts = $state<Record<string, string>>({});

	async function load() {
		loading = true;
		error = null;
		try {
			items = await organizations.list(filter === 'all' ? undefined : filter);
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось загрузить организации';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	async function decide(org: OrganizationListItem, approved: boolean) {
		if (busyId) return;
		const reason = reasonDrafts[org.id]?.trim();
		if (!approved && !reason) {
			error = 'Укажите причину отказа.';
			return;
		}
		busyId = org.id;
		error = null;
		try {
			await organizations.verify(org.id, { approved, reason: reason || undefined });
			items = items.filter((o) => o.id !== org.id);
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Не удалось сохранить решение';
		} finally {
			busyId = null;
		}
	}
</script>

<svelte:head><title>Организации · Админ-панель</title></svelte:head>

<div class="flex flex-col gap-6 p-4 sm:p-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 class="text-lg font-semibold text-slate-900">Верификация организаций</h2>
		<select
			bind:value={filter}
			class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
		>
			<option value="manual_review">На ручной проверке</option>
			<option value="failed">Отклонённые</option>
			<option value="pending">Ожидают</option>
			<option value="verified">Подтверждённые</option>
			<option value="all">Все</option>
		</select>
	</div>

	{#if error}<p class="text-sm text-red-700">{error}</p>{/if}

	{#if loading}
		<p class="text-sm text-slate-500">Загружаем…</p>
	{:else if items.length === 0}
		<p class="text-sm text-slate-500">Здесь пусто.</p>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each items as org (org.id)}
				<li class="rounded-lg border border-slate-200 bg-white p-4">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<p class="font-medium text-slate-900">{org.name}</p>
							<p class="text-xs text-slate-500">
								ИНН {org.inn} · зарегистрирована {formatDate(org.created_at)}
							</p>
						</div>
						<StatusPill
							label={VERIFICATION_LABEL[org.verification_status]}
							tone={org.verification_status === 'verified'
								? 'positive'
								: org.verification_status === 'failed'
									? 'negative'
									: 'warning'}
						/>
					</div>

					{#if org.verification_status !== 'verified'}
						<div class="mt-3 flex flex-wrap items-end gap-3">
							<label class="flex flex-1 flex-col gap-1 text-xs text-slate-500">
								Причина отказа (обязательна при отказе)
								<input
									value={reasonDrafts[org.id] ?? ''}
									oninput={(e) =>
										(reasonDrafts = { ...reasonDrafts, [org.id]: e.currentTarget.value })}
									class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
								/>
							</label>
							<button
								type="button"
								disabled={busyId === org.id}
								onclick={() => decide(org, true)}
								class="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
							>
								<Check size={16} /> Подтвердить
							</button>
							<button
								type="button"
								disabled={busyId === org.id}
								onclick={() => decide(org, false)}
								class="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
							>
								<X size={16} /> Отклонить
							</button>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
