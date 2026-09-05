import { browser } from '$app/environment';
import { ApiError, refreshAccess, setToken, setUnauthorizedHandler } from '$lib/api/client';
import {
	auth,
	isCoordinatorProfile,
	isStaffProfile,
	isVolunteerProfile,
	type Profile,
	type Schemas
} from '$lib/api/endpoints';
import type { Role } from '$lib/types';

/**
 * Сессия пользователя.
 *
 * Access-токен только в памяти; между перезагрузками поднимаемся через
 * httpOnly refresh-куку (`/auth/refresh`). localStorage для JWT больше не
 * используем — это и был долг P1-7.
 */
class Session {
	profile = $state<Profile | null>(null);
	ready = $state(false);
	busy = $state(false);
	error = $state<string | null>(null);

	get user() {
		return this.profile;
	}

	get role(): Role | null {
		return (this.profile?.role as Role | undefined) ?? null;
	}

	get isStaff(): boolean {
		return this.profile !== null && isStaffProfile(this.profile);
	}

	get isCoordinator(): boolean {
		return this.profile !== null && isCoordinatorProfile(this.profile);
	}

	get name(): string {
		return this.profile?.full_name ?? '';
	}

	get landingPath(): '/map' | '/org' | '/admin' {
		if (this.role === 'staff') return '/org';
		if (this.role === 'coordinator') return '/admin';
		return '/map';
	}

	get organizationId(): string | null {
		if (this.profile && isStaffProfile(this.profile)) return this.profile.organization.id;
		return null;
	}

	get organizationName(): string | null {
		if (this.profile && isStaffProfile(this.profile)) return this.profile.organization.name;
		return null;
	}

	/** Организация staff из `/auth/me` (имя, territory_osm_id, has_territory). */
	get organization(): Schemas['OrganizationOut'] | null {
		if (this.profile && isStaffProfile(this.profile)) return this.profile.organization;
		return null;
	}

	get hasMapAccess(): boolean {
		if (!this.profile) return false;
		if (isStaffProfile(this.profile)) return true;
		if (isVolunteerProfile(this.profile)) return this.profile.is_trained === true;
		return false;
	}

	get needsConsent(): boolean {
		return (
			this.profile !== null &&
			isVolunteerProfile(this.profile) &&
			this.profile.consent_status === 'awaiting'
		);
	}

	get certificateStatus(): Schemas['CertificateStatus'] {
		if (this.profile && isVolunteerProfile(this.profile)) {
			return this.profile.certificate_status ?? 'none';
		}
		return 'none';
	}

	constructor() {
		if (!browser) return;
		setUnauthorizedHandler(() => this.#clear());
	}

	/** Восстановить сессию по refresh-куке. */
	async restore(): Promise<void> {
		if (this.ready) return;
		try {
			const ok = await refreshAccess();
			if (!ok) {
				this.ready = true;
				return;
			}
			this.profile = await auth.me();
		} catch {
			this.#clear();
		} finally {
			this.ready = true;
		}
	}

	async refresh(): Promise<void> {
		try {
			this.profile = await auth.me();
		} catch (error) {
			if (error instanceof ApiError && error.isAuth) this.#clear();
		}
	}

	async login(email: string, password: string): Promise<boolean> {
		return this.#attempt(async () => {
			const { access_token } = await auth.login(email, password);
			setToken(access_token);
			this.profile = await auth.me();
		});
	}

	async registerVolunteer(body: Schemas['VolunteerRegisterRequest']): Promise<boolean> {
		return this.#attempt(async () => {
			await auth.registerVolunteer(body);
			const { access_token } = await auth.login(body.email, body.password);
			setToken(access_token);
			this.profile = await auth.me();
		});
	}

	async registerOrganization(body: Schemas['OrganizationRegisterRequest']): Promise<boolean> {
		return this.#attempt(async () => {
			await auth.registerOrganization(body);
			const { access_token } = await auth.login(body.email, body.password);
			setToken(access_token);
			this.profile = await auth.me();
		});
	}

	logout() {
		void auth.logout().catch(() => {});
		this.#clear();
	}

	async #attempt(action: () => Promise<void>): Promise<boolean> {
		this.busy = true;
		this.error = null;
		try {
			await action();
			return true;
		} catch (error) {
			this.error =
				error instanceof ApiError ? error.message : 'Что-то пошло не так, попробуйте ещё раз';
			return false;
		} finally {
			this.busy = false;
		}
	}

	#clear() {
		this.profile = null;
		setToken(null);
	}
}

export const session = new Session();
