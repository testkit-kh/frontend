import { browser } from '$app/environment';
import type { components } from './schema';

/**
 * Клиент бэкенда.
 *
 * Типы из OpenAPI (`pnpm run api:types`). Access-токен — только в памяти;
 * долгая сессия — httpOnly refresh-кука (`/auth/refresh`, P1-7).
 * `credentials: 'include'` обязателен на каждом запросе, иначе кука не уйдёт.
 */

export type Schemas = components['schemas'];

/** Legacy-ключ: раньше access лежал в localStorage. Чистим при любой записи. */
const LEGACY_TOKEN_KEY = 'kosmo.token';

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

	get isAuth(): boolean {
		return this.status === 401;
	}

	get isForbidden(): boolean {
		return this.status === 403;
	}

	get isUnavailable(): boolean {
		return this.status === 503;
	}
}

let token: string | null = null;
/** Один refresh на всех параллельных 401 — иначе ротация съест куку. */
let refreshInFlight: Promise<boolean> | null = null;

export function loadToken(): string | null {
	return token;
}

export function setToken(next: string | null) {
	token = next;
	if (!browser) return;
	try {
		localStorage.removeItem(LEGACY_TOKEN_KEY);
	} catch {
		/* private mode */
	}
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
	onUnauthorized = handler;
}

type RequestOptions = {
	method?: string;
	body?: unknown;
	form?: Record<string, string>;
	query?: Record<string, string | number | boolean | undefined>;
	anonymous?: boolean;
	signal?: AbortSignal;
	/** Внутренний: уже один раз ходили в refresh. */
	_retried?: boolean;
};

/**
 * Обменять refresh-куку на новый access. Без Bearer — только cookie.
 * Возвращает false при любой неудаче (истёк, кража → 403, нет сети).
 */
export async function refreshAccess(): Promise<boolean> {
	if (!browser) return false;
	if (refreshInFlight) return refreshInFlight;

	refreshInFlight = (async () => {
		try {
			const response = await fetch(new URL(`${BASE}/auth/refresh`, location.origin), {
				method: 'POST',
				credentials: 'include'
			});
			if (!response.ok) {
				setToken(null);
				return false;
			}
			const payload = (await response.json()) as Schemas['TokenResponse'];
			setToken(payload.access_token);
			return true;
		} catch {
			return false;
		} finally {
			refreshInFlight = null;
		}
	})();

	return refreshInFlight;
}

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
			credentials: 'include',
			signal: options.signal
		});
	} catch (cause) {
		throw new ApiError(0, 'Нет связи с сервером', cause);
	}

	if (response.status === 401 && !options.anonymous && !options._retried) {
		const ok = await refreshAccess();
		if (ok) {
			return request<T>(path, { ...options, _retried: true });
		}
		onUnauthorized?.();
	} else if (response.status === 401 && !options.anonymous) {
		onUnauthorized?.();
	}

	if (response.status === 204) return undefined as T;

	const payload = await response.json().catch(() => null);

	if (!response.ok) {
		throw new ApiError(response.status, detailOf(payload, response.status), payload);
	}

	return payload as T;
}

function detailOf(payload: unknown, status: number): string {
	if (payload && typeof payload === 'object' && 'detail' in payload) {
		const detail = (payload as { detail: unknown }).detail;
		if (typeof detail === 'string') return detail;
		if (Array.isArray(detail)) {
			const messages = detail.map((item) => (item as { msg?: string }).msg).filter(Boolean);
			if (messages.length) return messages.join('; ');
		}
	}
	if (status >= 500) {
		return status === 503
			? 'Сервис временно недоступен — попробуйте через пару минут.'
			: 'Сервер не смог обработать запрос. Мы уже видим эту ошибку — попробуйте позже.';
	}
	return `Ошибка ${status}`;
}
