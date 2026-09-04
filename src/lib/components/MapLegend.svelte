<script lang="ts">
	import { STATUS_COLOR, STATUS_LABEL, type ReportStatus } from '$lib/types';

	let { statuses }: { statuses: ReportStatus[] } = $props();
</script>

<div
	class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-xs font-medium text-slate-100 backdrop-blur-sm"
>
	{#each statuses as status (status)}
		<span class="flex items-center gap-2">
			<span
				class="h-2.5 w-2.5 rounded-full ring-2 ring-white/80"
				style="background:{STATUS_COLOR[status]}"
			></span>
			{STATUS_LABEL[status]}
		</span>
	{/each}
</div>
