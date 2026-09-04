<script lang="ts">
	import { CircleCheck, Clock, Plane, X } from '@lucide/svelte';
	import { STATUS_LABEL, type ReportStatus } from '$lib/types';

	let { status }: { status: ReportStatus } = $props();

	const STYLE: Record<ReportStatus, string> = {
		pending: 'border-amber-200 bg-amber-50 text-amber-700',
		confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
		drone: 'border-sky-200 bg-sky-50 text-sky-700',
		rejected: 'border-slate-200 bg-slate-50 text-slate-500'
	};

	const ICON = { pending: Clock, confirmed: CircleCheck, drone: Plane, rejected: X };
	const Icon = $derived(ICON[status]);
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium {STYLE[
		status
	]}"
>
	<Icon size={14} />
	{STATUS_LABEL[status]}
</span>
