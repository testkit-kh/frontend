import { browser } from '$app/environment';
import type { Role, User } from '$lib/types';

const KEY = 'kosmo.session';

class Session {
	user = $state<User | null>(null);
	ready = $state(false);

	constructor() {
		if (!browser) return;
		const raw = localStorage.getItem(KEY);
		if (raw) {
			try {
				this.user = JSON.parse(raw) as User;
			} catch {
				localStorage.removeItem(KEY);
			}
		}
		this.ready = true;
	}

	#persist() {
		if (!browser) return;
		if (this.user) localStorage.setItem(KEY, JSON.stringify(this.user));
		else localStorage.removeItem(KEY);
	}

	login(email: string, role: Role) {
		this.user = {
			id: crypto.randomUUID(),
			name: role === 'staff' ? 'Сотрудник ООПТ' : 'Волонтёр',
			email,
			role,
			organizationId: role === 'staff' ? 'utrish' : undefined,
			onboarded: true
		};
		this.#persist();
	}

	register(name: string, email: string, role: Role) {
		this.user = {
			id: crypto.randomUUID(),
			name: name.trim() || 'Волонтёр',
			email,
			role,
			organizationId: role === 'staff' ? 'utrish' : undefined,
			onboarded: true
		};
		this.#persist();
	}

	logout() {
		this.user = null;
		this.#persist();
	}
}

export const session = new Session();
