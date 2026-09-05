import { notifications } from '$lib/api/endpoints';

/**
 * Счётчик непрочитанных для колокольчика в шапке.
 *
 * Отдельным маленьким состоянием, а не частью сессии: он обновляется по своему
 * расписанию и не должен тянуть за собой перечитывание профиля.
 */
class UnreadCounter {
	count = $state(0);

	set(value: number) {
		this.count = value;
	}

	decrement() {
		if (this.count > 0) this.count -= 1;
	}

	/** Подтянуть счётчик с сервера. Ошибку глотаем: колокольчик — не то, ради
	 *  чего стоит показывать человеку сообщение об ошибке. */
	async refresh(): Promise<void> {
		try {
			const response = await notifications.list(true);
			this.count = response.unread_count;
		} catch {
			/* тихо: счётчик догонит при следующей попытке */
		}
	}
}

export const unread = new UnreadCounter();
