import type { Report } from '$lib/types';

/**
 * Состояние берега — одно правило на всё приложение.
 *
 * Логотип проекта существует в двух настроениях, и это не декор: по нему
 * человек должен с одного взгляда понимать, требует ли территория внимания.
 * Чтобы «весёлый» и «злой» значили одно и то же в шапке, в списке территорий
 * и на карте, правило живёт здесь, а не в каждом компоненте отдельно.
 */

export type Mood = 'clean' | 'dirty';

/**
 * Точка считается открытой, если её ещё не отработали: она на проверке,
 * подтверждена (значит мусор там есть и лежит) или ждёт облёта дроном.
 * Отклонённые не в счёт — их не существует как проблемы.
 */
function isOpen(report: Report): boolean {
	return report.status !== 'rejected';
}

/**
 * Порог, за которым берег считается грязным.
 *
 * Пять открытых точек — величина, подобранная под демонстрацию, а не
 * измеренная: у Кроноцкого заповедника и у Куршской косы разные масштабы, и
 * честный порог должен нормироваться на длину береговой линии. Когда с бэка
 * придут километры под наблюдением, считать надо будет на 100 км берега.
 */
export const DIRTY_THRESHOLD = 5;

export type TerritoryHealth = {
	open: number;
	total: number;
	mood: Mood;
};

export function territoryHealth(reports: Report[], territoryId: string): TerritoryHealth {
	const inTerritory = reports.filter((r) => r.territoryId === territoryId);
	const open = inTerritory.filter(isOpen).length;
	return {
		open,
		total: inTerritory.length,
		mood: open >= DIRTY_THRESHOLD ? 'dirty' : 'clean'
	};
}

/** Состояние по всем территориям сразу — для обзора страны. */
export function healthByTerritory(reports: Report[]): Map<string, TerritoryHealth> {
	const counts = new Map<string, { open: number; total: number }>();

	for (const report of reports) {
		const entry = counts.get(report.territoryId) ?? { open: 0, total: 0 };
		entry.total += 1;
		if (isOpen(report)) entry.open += 1;
		counts.set(report.territoryId, entry);
	}

	return new Map(
		[...counts].map(([id, { open, total }]) => [
			id,
			{ open, total, mood: (open >= DIRTY_THRESHOLD ? 'dirty' : 'clean') as Mood }
		])
	);
}

/** Настроение страны целиком — для шапки и обзорного экрана. */
export function overallMood(reports: Report[]): Mood {
	const territories = healthByTerritory(reports);
	if (territories.size === 0) return 'clean';
	const dirty = [...territories.values()].filter((h) => h.mood === 'dirty').length;
	// Треть территорий в плохом состоянии — уже повод показать хмурый знак.
	return dirty * 3 >= territories.size ? 'dirty' : 'clean';
}
