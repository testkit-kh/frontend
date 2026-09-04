import type { Report, ReportKind, ReportSource, ReportStatus } from '$lib/types';

class Reports {
	items = $state<Report[]>([]);

	hydrate(items: Report[]) {
		this.items = items;
	}

	pendingIn(territoryId: string) {
		return this.items
			.filter((r) => r.status === 'pending' && r.territoryId === territoryId)
			.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	}

	visibleTo(author: string) {
		return this.items.filter(
			(r) => r.status === 'confirmed' || (r.status !== 'rejected' && r.author === author)
		);
	}

	add(input: {
		territoryId: string;
		kind: ReportKind;
		source: ReportSource;
		title: string;
		note: string;
		author: string;
		geometry: Report['geometry'];
	}): Report {
		const report: Report = {
			id: crypto.randomUUID(),
			createdAt: new Date().toISOString().slice(0, 10),
			status: 'pending',
			...input
		};
		this.items = [report, ...this.items];
		return report;
	}

	decide(id: string, status: ReportStatus, verdict: string) {
		this.items = this.items.map((r) => (r.id === id ? { ...r, status, verdict } : r));
	}

	schedule(id: string, date: string) {
		this.items = this.items.map((r) =>
			r.id === id ? { ...r, event: { date, signed: r.event?.signed ?? 0 } } : r
		);
	}

	join(id: string) {
		this.items = this.items.map((r) =>
			r.id === id && r.event ? { ...r, event: { ...r.event, signed: r.event.signed + 1 } } : r
		);
	}
}

export const reports = new Reports();
