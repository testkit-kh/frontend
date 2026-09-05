import { browser } from '$app/environment';
import type { components } from './schema';

/**
 * Клиент бэкенда.
 *
 * Типы не пишутся руками, а генерируются из OpenAPI (`pnpm run api:types`):
 * иначе они молча разъезжаются с бэком, и об этом узнают в проде. Схема лежит
 * в репозитории, поэтому сборке не нужен работающий сервер.
 *
 * ## Про хранение токена
 *
 * Токен лежит в `localStorage`. Это осознанный компромисс, а не недосмотр:
 * у бэкенда пока нет refresh-токенов, а держать access только в памяти значит
 * разлогинивать человека на каждом обновлении страницы — на берегу, где
 * интернет и так рвётся, это неприемлемо.
 *
 * Плата за это — уязвимость к XSS: любой выполненный на странице чужой скрипт
 * прочитает токен. Правильное решение — refresh в httpOnly-куке и короткий
 * access в памяти; оно требует ручек на бэкенде и записано в PLAN.md как долг.
 * Пока его нет, единственная защита — не допускать XSS: Svelte экранирует
 * вывод по умолчанию, и в проекте нет ни одного `{@html}`.
 */

export type Schemas = components['schemas'];

const TOKEN_KEY = 'kosmo.token';

/** Базовый адрес API. По умолчанию — пусто: те же пути (/auth, /api), что
 *  знает и дев-прокси Vite, и прод-Caddy. VITE_API_URL нужен только если API
 *  вынесен на отдельный домен. */
const BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly detail: string,
		readonly body?: unknown
	) {
		super(detail);
		this.name = 'ApiError';
	}

	/** Не авторизован или токен протух. */
	get isAuth(): boolean {
		return this.status === 401;
	}

	/** Доступ есть, но не хватает прав или не пройден шаг воронки. */
	get isForbidden(): boolean {
		return this.status === 403;
	}

	/** Внешний сервис недоступен — это не вина пользователя. */
	get isUnavailable(): boolean {
		return this.status === 503;
	}
}

let token: string | null = null;

export function loadToken(): string | null {
	if (token) return token;
	if (!browser) return null;
	try {
		token = localStorage.getItem(TOKEN_KEY);
	} catch {
		// Приватный режим или заблокированное хранилище: работаем без
		// сохранения между перезагрузками, но не падаем.
		token = null;
	}
	return token;
}

export function setToken(next: string | null) {
	token = next;
	if (!browser) return;
	try {
		if (next) localStorage.setItem(TOKEN_KEY, next);
		else localStorage.removeItem(TOKEN_KEY);
	} catch {
		/* хранилище недоступно — токен живёт только в памяти вкладки */
	}
}

/** Вызывается при 401: слой сессии на это разлогинивает и уводит на вход. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
	onUnauthorized = handler;
}

type RequestOptions = {
	method?: string;
	body?: unknown;
	/** Данные формы вместо JSON — нужно для OAuth2-совместимого /auth/login. */
	form?: Record<string, string>;
	query?: Record<string, string | number | boolean | undefined>;
	/** Не отправлять токен: ручки регистрации и реестра работают без него. */
	anonymous?: boolean;
	signal?: AbortSignal;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
	const url = new URL(`${BASE}${path}`, browser ? location.origin : 'http://localhost');
	for (const [key, value] of Object.entries(options.query ?? {})) {
		if (value !== undefined) url.searchParams.set(key, String(value));
	}

	const headers: Record<string, string> = {};
	const auth = options.anonymous ? null : loadToken();
	if (auth) headers.Authorization = `Bearer ${auth}`;

	let body: BodyInit | undefined;
	if (options.form) {
		headers['Content-Type'] = 'application/x-www-form-urlencoded';
		body = new URLSearchParams(options.form).toString();
	} else if (options.body !== undefined) {
		headers['Content-Type'] = 'application/json';
		body = JSON.stringify(options.body);
	}

	let response: Response;
	try {
		response = await fetch(url, {
			method: options.method ?? (body ? 'POST' : 'GET'),
			headers,
			body,
			signal: options.signal
		});
	} catch (cause) {
		// Сеть пропала. Отдельный статус 0, чтобы вызывающий код мог отличить
		// «нет связи» от «сервер ответил ошибкой» — на берегу это разные
		// ситуации с разными подсказками для человека.
		throw new ApiError(0, 'Нет связи с сервером', cause);
	}

	if (response.status === 401 && !options.anonymous) {
		onUnauthorized?.();
	}

	if (response.status === 204) return undefined as T;

	const payload = await response.json().catch(() => null);

	if (!response.ok) {
		throw new ApiError(response.status, detailOf(payload, response.status), payload);
	}

	return payload as T;
}

/**
 * Человекочитаемое сообщение из ответа FastAPI.
 *
 * `detail` бывает строкой (наши HTTPException) и массивом ошибок валидации
 * (422 от pydantic) — показывать пользователю `[object Object]` нельзя.
 */
function detailOf(payload: unknown, status: number): string {
	if (payload && typeof payload === 'object' && 'detail' in payload) {
		const detail = (payload as { detail: unknown }).detail;
		if (typeof detail === 'string') return detail;
		if (Array.isArray(detail)) {
			const messages = detail.map((item) => (item as { msg?: string }).msg).filter(Boolean);
			if (messages.length) return messages.join('; ');
		}
	}
	return `Ошибка ${status}`;
}
