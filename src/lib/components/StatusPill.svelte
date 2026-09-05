<script lang="ts">
	/**
	 * Универсальный статус-бейдж для кабинетов ООПТ/координатора.
	 *
	 * В отличие от StatusBadge.svelte (завязан на моковый ReportStatus), здесь
	 * тон и подпись передаёт вызывающий код — статусов на бэкенде несколько
	 * разных enum'ов (HypothesisStatus, EventStatus, ParcelStatus, ...), и
	 * заводить отдельный компонент под каждый смысла нет.
	 */
	type Tone = 'neutral' | 'positive' | 'warning' | 'negative' | 'info';

	let { label, tone = 'neutral' }: { label: string; tone?: Tone } = $props();

	const STYLE: Record<Tone, string> = {
		neutral: 'border-slate-200 bg-slate-50 text-slate-600',
		positive: 'border-emerald-200 bg-emerald-50 text-emerald-700',
		warning: 'border-amber-200 bg-amber-50 text-amber-700',
		negative: 'border-red-200 bg-red-50 text-red-700',
		info: 'border-sky-200 bg-sky-50 text-sky-700'
	};
</script>

<span
	class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium {STYLE[
		tone
	]}"
>
	{label}
</span>
