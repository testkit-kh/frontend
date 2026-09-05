<script lang="ts">
	import {
		CircleCheck,
		CircleDashed,
		Clock,
		Download,
		ExternalLink,
		Share2,
		TriangleAlert
	} from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ApiError } from '$lib/api/client';
	import { certificates, type CertificateInfo } from '$lib/api/certificates';
	import { course, type CourseStatus } from '$lib/api/endpoints';
	import { uploads } from '$lib/api/uploads';
	import Logo from '$lib/components/Logo.svelte';
	import { session } from '$lib/state/session.svelte';

	/**
	 * Путь обучения одним экраном.
	 *
	 * Курс идёт на внешней площадке («Школа Защитников Природы» на iSpring), и
	 * между уходом туда и возвращением мы человека не видим — в KPI-документе
	 * это названо «слепой зоной» и признано главным риском воронки. Поэтому
	 * экран не просто даёт ссылку, а показывает, где человек сейчас, и всегда
	 * называет следующий шаг.
	 */

	let status = $state<CourseStatus | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let certificateUrl = $state('');
	let certificateFile = $state<File | null>(null);
	let submitting = $state(false);
	let submitError = $state<string | null>(null);

	let redirecting = $state(false);
	let redirectError = $state<string | null>(null);

	// Ручки сертификата ещё нет на бэке (см. certificates.ts) — 404 просто
	// не показывает блок, а не роняет страницу.
	let certificate = $state<CertificateInfo | null>(null);
	let shareNote = $state<string | null>(null);

	$effect(() => {
		if (status?.certificate_status !== 'approved') return;
		certificates
			.mine()
			.then((info) => (certificate = info))
			.catch(() => {});
	});

	async function shareCertificate() {
		if (!certificate) return;
		const url = `${page.url.origin}${resolve('/verify/[code]', { code: certificate.code })}`;
		try {
			await certificates.share(certificate.code);
		} catch {
			/* событие certificate_shared не критично для самого шеринга */
		}
		if (navigator.share) {
			await navigator.share({ title: 'Мой сертификат «Чистого берега»', url }).catch(() => {});
			return;
		}
		await navigator.clipboard.writeText(url).catch(() => {});
		shareNote = 'Ссылка скопирована';
		setTimeout(() => (shareNote = null), 3000);
	}

	async function goToCourse() {
		if (redirecting) return;
		redirecting = true;
		redirectError = null;
		try {
			const { url } = await course.redirect();
			window.location.href = url;
		} catch (cause) {
			redirectError = cause instanceof ApiError ? cause.message : 'Не удалось перейти к курсу';
			redirecting = false;
		}
	}

	async function load() {
		loading = true;
		error = null;
		try {
			status = await course.status();
		} catch (cause) {
			error = cause instanceof ApiError ? cause.message : 'Не удалось загрузить статус';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (submitting) return;
		if (!certificateUrl.trim() && !certificateFile) return;

		submitting = true;
		submitError = null;
		try {
			let url = certificateUrl.trim();
			if (certificateFile) {
				try {
					url = await uploads.putFile(certificateFile, 'certificate');
				} catch (cause) {
					if (cause instanceof ApiError && (cause.status === 404 || cause.status === 501)) {
						throw new ApiError(
							cause.status,
							'Загрузка файла пока недоступна — пришлите публичную ссылку на сертификат.'
						);
					}
					throw cause;
				}
			}
			await course.submitCertificate(url);
			certificateUrl = '';
			certificateFile = null;
			await Promise.all([load(), session.refresh()]);
		} catch (cause) {
			submitError = cause instanceof ApiError ? cause.message : 'Не удалось отправить';
		} finally {
			submitting = false;
		}
	}

	type Step = { title: string; note: string; state: 'done' | 'current' | 'waiting' };

	const steps = $derived.by<Step[]>(() => {
		const certificate = status?.certificate_status ?? 'none';
		const started = Boolean(status?.course_redirect_at);

		return [
			{
				title: 'Регистрация',
				note: 'Аккаунт создан',
				state: 'done'
			},
			{
				title: 'Обучение',
				note: started ? 'Вы перешли на курс' : 'Курс ещё не начат',
				state: started ? 'done' : 'current'
			},
			{
				title: 'Сертификат',
				note:
					certificate === 'approved'
						? 'Принят'
						: certificate === 'pending'
							? 'На проверке у координатора'
							: certificate === 'rejected'
								? 'Отклонён — нужно отправить заново'
								: 'Ещё не отправлен',
				state: certificate === 'approved' ? 'done' : started ? 'current' : 'waiting'
			},
			{
				title: 'Карта',
				note: certificate === 'approved' ? 'Открыта' : 'Откроется после проверки сертификата',
				state: certificate === 'approved' ? 'done' : 'waiting'
			}
		];
	});

	const canSubmit = $derived(
		status?.certificate_status !== 'approved' && status?.certificate_status !== 'pending'
	);
</script>

<svelte:head><title>Обучение · Чистый берег</title></svelte:head>

<div class="h-full overflow-y-auto">
	<div class="mx-auto flex max-w-2xl flex-col gap-6 p-4 pb-16 sm:p-6">
		<header class="flex items-start gap-4">
			<Logo mood={status?.has_map_access ? 'clean' : 'dirty'} size={52} />
			<div>
				<h1 class="text-xl font-semibold text-slate-900">Обучение</h1>
				<p class="mt-1 text-sm text-slate-500">
					Бесплатный курс «Школы Защитников Природы»: геоданные, дистанционное зондирование и анализ
					снимков. После проверки сертификата откроется карта.
				</p>
			</div>
		</header>

		{#if loading}
			<p class="text-sm text-slate-500">Загружаем…</p>
		{:else if error}
			<div class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
				<TriangleAlert size={16} class="mt-0.5 shrink-0 text-red-500" />
				<div class="flex-1">
					<p class="text-red-800">{error}</p>
					<button type="button" onclick={load} class="mt-2 font-medium text-red-900 underline">
						Попробовать снова
					</button>
				</div>
			</div>
		{:else if status}
			<!-- Прогресс: человек должен видеть, где он и что дальше, не читая текст -->
			<ol class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
				{#each steps as step (step.title)}
					<li class="flex items-start gap-3">
						{#if step.state === 'done'}
							<CircleCheck size={18} class="mt-0.5 shrink-0 text-emerald-600" />
						{:else if step.state === 'current'}
							<Clock size={18} class="mt-0.5 shrink-0 text-amber-500" />
						{:else}
							<CircleDashed size={18} class="mt-0.5 shrink-0 text-slate-300" />
						{/if}
						<div class="min-w-0">
							<p
								class="text-sm {step.state === 'waiting'
									? 'text-slate-400'
									: 'font-medium text-slate-900'}"
							>
								{step.title}
							</p>
							<p class="text-xs text-slate-500">{step.note}</p>
						</div>
					</li>
				{/each}
			</ol>

			{#if status.certificate_status === 'rejected' && status.certificate_reject_reason}
				<div
					class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm"
				>
					<TriangleAlert size={16} class="mt-0.5 shrink-0 text-amber-600" />
					<div>
						<p class="font-medium text-amber-900">Сертификат отклонён</p>
						<p class="mt-0.5 text-amber-800">{status.certificate_reject_reason}</p>
					</div>
				</div>
			{/if}

			<!-- Переход идёт через наш бэкенд, а не прямо на iSpring: только так
			     фиксируется переход, от которого считается вся метрика возврата.
			     Кнопка, а не ссылка: адрес курса известен только после
			     авторизованного запроса. -->
			<button
				type="button"
				onclick={goToCourse}
				disabled={redirecting}
				class="flex min-h-12 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
			>
				{redirecting
					? 'Переходим…'
					: status.course_redirect_at
						? 'Продолжить обучение'
						: 'Перейти к курсу'}
				<ExternalLink size={16} />
			</button>
			{#if redirectError}
				<p class="text-xs text-red-700">{redirectError}</p>
			{/if}

			{#if status.certificate_status === 'pending'}
				<p class="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
					Сертификат отправлен и ждёт проверки координатора. Мы пришлём уведомление, как только
					будет решение — заходить и обновлять страницу не нужно.
				</p>
			{:else if canSubmit}
				<form class="flex flex-col gap-3" onsubmit={submit}>
					<label class="flex flex-col gap-1 text-xs text-slate-500">
						Ссылка на сертификат
						<input
							bind:value={certificateUrl}
							type="url"
							placeholder="https://zaprirodu.ispring.ru/..."
							class="min-h-12 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
						/>
						<span class="text-slate-400">
							Публичная ссылка со страницы курса. Можно вместо файла.
						</span>
					</label>

					<label class="flex flex-col gap-1 text-xs text-slate-500">
						Или файл (pdf / изображение)
						<input
							type="file"
							accept="application/pdf,image/*"
							onchange={(event) => (certificateFile = event.currentTarget.files?.[0] ?? null)}
							class="text-xs text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
						/>
						<span class="text-slate-400">
							Нужна ручка загрузки на бэке; пока её нет — отправьте ссылку.
						</span>
					</label>

					{#if submitError}
						<p class="text-xs text-red-700">{submitError}</p>
					{/if}

					<button
						type="submit"
						disabled={submitting || (!certificateUrl.trim() && !certificateFile)}
						class="min-h-12 rounded-full border border-slate-300 px-5 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:text-slate-400"
					>
						{submitting ? 'Отправляем…' : 'Отправить на проверку'}
					</button>
				</form>
			{/if}

			{#if status.certificate_status === 'approved' && certificate}
				<div class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
					<div>
						<p class="text-sm font-medium text-slate-900">Сертификат №{certificate.code}</p>
						<p class="mt-0.5 text-xs text-slate-500">
							Выдан {new Date(certificate.issued_at).toLocaleDateString('ru-RU')}
						</p>
					</div>
					<div class="flex flex-wrap gap-2">
						<!-- pdf_url приходит с бэка (S3/presigned), не роут приложения. -->
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							href={certificate.pdf_url}
							target="_blank"
							rel="noreferrer"
							class="flex min-h-11 items-center gap-2 rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
						>
							<Download size={16} /> Скачать PDF
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
						<button
							type="button"
							onclick={shareCertificate}
							class="flex min-h-11 items-center gap-2 rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
						>
							<Share2 size={16} /> Поделиться
						</button>
						{#if shareNote}
							<span class="flex items-center text-xs text-slate-500">{shareNote}</span>
						{/if}
					</div>
				</div>
			{/if}

			{#if status.has_map_access}
				<button
					type="button"
					onclick={() => goto(resolve('/map'))}
					class="min-h-12 rounded-full bg-emerald-600 px-5 text-sm font-medium text-white hover:bg-emerald-700"
				>
					Открыть карту
				</button>
			{/if}
		{/if}
	</div>
</div>
