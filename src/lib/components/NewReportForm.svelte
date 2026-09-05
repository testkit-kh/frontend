<script lang="ts">
	import { MapPin, Undo2, Waves, X } from '@lucide/svelte';
	import { formatCoords } from '$lib/format';
	import type { ReportKind } from '$lib/types';

	let {
		kind,
		draftPoint,
		draftArea,
		onkind,
		onundo,
		oncancel,
		onsubmit
	}: {
		kind: ReportKind;
		draftPoint: [number, number] | null;
		draftArea: [number, number][];
		onkind: (kind: ReportKind) => void;
		onundo: () => void;
		oncancel: () => void;
		onsubmit: (values: { title: string; note: string; photo: File | null }) => void;
	} = $props();

	let title = $state('');
	let note = $state('');
	let photo = $state<File | null>(null);

	const ready = $derived(
		title.trim().length > 2 && (kind === 'trash' ? Boolean(draftPoint) : draftArea.length >= 3)
	);
</script>

<form
	class="flex flex-col gap-4 p-4"
	onsubmit={(event) => {
		event.preventDefault();
		if (ready) onsubmit({ title: title.trim(), note: note.trim(), photo });
	}}
>
	<div class="flex items-start gap-3">
		<div class="min-w-0 flex-1">
			<h2 class="text-base font-semibold text-slate-900">Новая гипотеза</h2>
			<p class="mt-1 text-xs text-slate-500">
				Отметьте место на карте. Точку проверит сотрудник ООПТ — она появится у остальных волонтёров
				только после подтверждения.
			</p>
		</div>
		<button
			type="button"
			onclick={oncancel}
			aria-label="Отменить"
			class="-mt-2 -mr-2 shrink-0 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
		>
			<X size={16} />
		</button>
	</div>

	<div class="flex gap-1 rounded-full bg-slate-100 p-1 text-sm" role="group" aria-label="Тип">
		<button
			type="button"
			aria-pressed={kind === 'trash'}
			onclick={() => onkind('trash')}
			class="flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-slate-600 aria-pressed:bg-white aria-pressed:font-medium aria-pressed:text-slate-900"
		>
			<MapPin size={16} /> Мусор
		</button>
		<button
			type="button"
			aria-pressed={kind === 'spill'}
			onclick={() => onkind('spill')}
			class="flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-slate-600 aria-pressed:bg-white aria-pressed:font-medium aria-pressed:text-slate-900"
		>
			<Waves size={16} /> Разлив
		</button>
	</div>

	<div class="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
		<span class="min-w-0 flex-1 text-slate-600">
			{#if kind === 'trash'}
				{#if draftPoint}
					Метка: {formatCoords(draftPoint)}
				{:else}
					Кликните по карте, чтобы поставить метку
				{/if}
			{:else if draftArea.length === 0}
				Кликайте по карте, чтобы обвести пятно
			{:else}
				Вершин: {draftArea.length}{draftArea.length < 3 ? ' — нужно минимум три' : ''}
			{/if}
		</span>
		{#if draftPoint || draftArea.length}
			<button
				type="button"
				onclick={onundo}
				class="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
			>
				<Undo2 size={14} /> Отменить
			</button>
		{/if}
	</div>

	<label class="flex flex-col gap-1 text-xs text-slate-500">
		Что нашли
		<input
			bind:value={title}
			required
			placeholder="Например: свалка после шторма"
			class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
		/>
	</label>

	<label class="flex flex-col gap-1 text-xs text-slate-500">
		Описание
		<textarea
			bind:value={note}
			rows="3"
			placeholder="Объём, что именно за мусор, как подъехать"
			class="resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
		></textarea>
	</label>

	{#if kind === 'trash'}
		<label class="flex flex-col gap-1 text-xs text-slate-500">
			Фото (необязательно)
			<input
				type="file"
				accept="image/*"
				capture="environment"
				onchange={(event) => (photo = event.currentTarget.files?.[0] ?? null)}
				class="text-xs text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
			/>
			<span class="text-slate-400">
				Точка уходит на сервер сразу; без связи — сама досылается, как только она появится.
			</span>
		</label>
	{/if}

	<button
		type="submit"
		disabled={!ready}
		class="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400"
	>
		Отправить в предложку
	</button>
</form>
