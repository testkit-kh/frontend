/* Background Sync → клиент дергает IndexedDB-очередь.
 * Подключается из vite PWA workbox.importScripts. */
self.addEventListener('sync', (event) => {
	if (event.tag !== 'cb-offline-queue') return;
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
			for (const client of clients) {
				client.postMessage({ type: 'cb-sync' });
			}
		})
	);
});
