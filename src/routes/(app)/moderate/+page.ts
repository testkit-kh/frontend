import { redirect } from '@sveltejs/kit';

// Очередь валидации переехала в кабинет ООПТ — реальные данные вместо мока.
export function load() {
	redirect(307, '/org/queue');
}
