import type { Report, ReportKind, ReportSource, ReportStatus } from '$lib/types';

/**
 * Точки на карте: настоящие с бэкенда плюс демонстрационные.
 *
 * Раньше здесь были только демо-данные из `static/data/reports.json`, и
 * отправленное волонтёром наблюдение до карты не доезжало вовсе — оно жило
 * ровно до перезагрузки страницы. Теперь есть два слоя:
 *
 *  • `remote` — то, что отдал API (`/hypotheses/my`, `/map/layers`). Он
 *    перезаписывается целиком при каждой загрузке: сервер тут единственный
 *    источник правды, склеивать его с локальными правками нельзя.
 *  • `seeded` — демо-набор. Без него пустая карта не показывает ни легенды,
 *    ни смысла продукта, а на демонстрации это важно. Он же принимает
 *    полигоны разливов, которых бэкенд пока не хранит.
 *
 * `items` — их объединение; настоящие точки идут первыми, чтобы при
 * совпадении id (демо-данные генерируются с UUID) выигрывала правда сервера.
 */
class Reports {
	seeded = $state<Report[]>([]);
	remote = $state<Report[]>([]);

	get items(): Report[] {
		const seen = new Set(this.remote.map((r) => r.id));
		return [...this.remote, ...this.seeded.filter((r) => !seen.has(r.id))];
	}

	hydrate(items: Report[]) {
		this.seeded = items;
	}

	/** Заменить слой сервера. Вызывается после каждой загрузки карты. */
	mergeRemote(items: Report[]) {
		this.remote = items;
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
		id?: string;
		territoryId: string;
		kind: ReportKind;
		source: ReportSource;
		title: string;
		note: string;
		author: string;
		geometry: Report['geometry'];
		status?: ReportStatus;
	}): Report {
		const report: Report = {
			id: input.id ?? crypto.randomUUID(),
			createdAt: new Date().toISOString().slice(0, 10),
			status: input.status ?? 'pending',
			territoryId: input.territoryId,
			kind: input.kind,
			source: input.source,
			title: input.title,
			note: input.note,
			author: input.author,
			geometry: input.geometry
		};
		// Живая точка с сервера — в remote, иначе после reload её затрёт
		// mergeRemote, а демо-полигон разлива остаётся в seeded.
		if (input.id) {
			this.remote = [report, ...this.remote.filter((r) => r.id !== report.id)];
		} else {
			this.seeded = [report, ...this.seeded];
		}
		return report;
	}

	decide(id: string, status: ReportStatus, verdict: string) {
		this.seeded = this.seeded.map((r) => (r.id === id ? { ...r, status, verdict } : r));
		this.remote = this.remote.map((r) => (r.id === id ? { ...r, status, verdict } : r));
	}

	schedule(id: string, date: string, eventId?: string) {
		const patch = (r: Report) =>
			r.id === id
				? {
						...r,
						event: {
							id: eventId ?? r.event?.id,
							date,
							signed: r.event?.signed ?? 0,
							isJoined: r.event?.isJoined
						}
					}
				: r;
		this.seeded = this.seeded.map(patch);
		this.remote = this.remote.map(patch);
	}

	/** Локальный счётчик / флаг записи. Настоящая запись — `events.join`. */
	join(id: string, joined = true) {
		const patch = (r: Report) =>
			r.id === id && r.event
				? {
						...r,
						event: {
							...r.event,
							signed: joined
								? r.event.signed + (r.event.isJoined ? 0 : 1)
								: Math.max(0, r.event.signed - 1),
							isJoined: joined
						}
					}
				: r;
		this.seeded = this.seeded.map(patch);
		this.remote = this.remote.map(patch);
	}
}

export const reports = new Reports();
