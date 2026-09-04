<script lang="ts">
	import { MapPin, Waves } from '@lucide/svelte';
	import { formatDate } from '$lib/format';
	import { STATUS_COLOR, type Report } from '$lib/types';

	let {
		items,
		selectedId = null,
		onselect,
		empty = 'Пока ничего нет'
	}: {
		items: Report[];
		selectedId?: string | null;
		onselect: (id: string) => void;
		empty?: string;
	} = $props();
</script>

{#if items.length === 0}
	<p class="p-4 text-sm text-slate-500">{empty}</p>
{:else}
	<ul class="divide-y divide-slate-200 overflow-y-auto">
		{#each items as report (report.id)}
			<li>
				<button
					type="button"
					onclick={() => onselect(report.id)}
					aria-current={report.id === selectedId ? 'true' : undefined}
					class="flex w-full items-start gap-3 p-4 text-left hover:bg-slate-50 aria-[current]:bg-slate-50"
				>
					<span
						class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
						style="background:{STATUS_COLOR[report.status]}"
					>
						{#if report.kind === 'spill'}
							<Waves size={16} />
						{:else}
							<MapPin size={16} />
						{/if}
					</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate text-sm font-medium text-slate-900">{report.title}</span>
						<span class="block truncate text-xs text-slate-500">
							{report.author} · {formatDate(report.createdAt)}
							{#if report.event}
								· выезд {formatDate(report.event.date)}
							{/if}
						</span>
					</span>
				</button>
			</li>
		{/each}
	</ul>
{/if}
