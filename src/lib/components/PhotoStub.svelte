<script lang="ts">
	import { Camera } from '@lucide/svelte';
	import type { ReportKind } from '$lib/types';

	let { id, kind, alt }: { id: string; kind: ReportKind; alt: string } = $props();

	function hash(value: string) {
		let acc = 0;
		for (const char of value) acc = (acc * 31 + char.codePointAt(0)!) % 100000;
		return acc;
	}

	const blobs = $derived(
		Array.from({ length: 5 }, (_, i) => {
			const seed = hash(id + i);
			return {
				cx: 12 + (seed % 76),
				cy: 52 + ((seed >> 3) % 40),
				r: 2 + ((seed >> 7) % 5),
				rotate: seed % 180
			};
		})
	);

	const sea = $derived(kind === 'spill' ? '#1e3a4f' : '#2f6f8f');
	const shore = $derived(kind === 'spill' ? '#3f3a33' : '#c9b998');
</script>

<figure class="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
	<svg viewBox="0 0 100 100" class="block h-full w-full" role="img" aria-label={alt}>
		<rect width="100" height="52" fill={sea} />
		<rect y="46" width="100" height="54" fill={shore} />
		<path d="M0 52 Q 25 44 50 51 T 100 47 V 58 H 0 Z" fill="#ffffff" opacity="0.35" />
		{#each blobs as blob, i (i)}
			<ellipse
				cx={blob.cx}
				cy={blob.cy}
				rx={blob.r}
				ry={blob.r * 0.6}
				transform="rotate({blob.rotate} {blob.cx} {blob.cy})"
				fill={kind === 'spill' ? '#0b0b0b' : '#e2e8f0'}
				opacity="0.75"
			/>
		{/each}
	</svg>

	<figcaption
		class="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-slate-900/70 px-3 py-2 text-xs text-white"
	>
		<Camera size={14} />
		{alt} · демо-изображение
	</figcaption>
</figure>
