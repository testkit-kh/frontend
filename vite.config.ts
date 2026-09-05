import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	optimizeDeps: { exclude: ['maplibre-gl'] },
	server: {
		// Прокси в разработке: фронт и бэк на разных портах, и без него каждый
		// запрос тащил бы за собой preflight. В проде те же пути (/auth, /api)
		// заворачивает Caddy, поэтому код клиента одинаков и там, и там.
		proxy: {
			'/auth': {
				target: process.env.VITE_API_TARGET ?? 'http://localhost:8000',
				changeOrigin: true
			},
			'/api': {
				target: process.env.VITE_API_TARGET ?? 'http://localhost:8000',
				changeOrigin: true
			}
		}
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter()
		}),
		// Офлайн — не приятная фича, а условие продукта (Командоры, ЗФИ,
		// Кроноцкий связи physически не имеют): прекэш шелла + рантайм-кэш
		// тайлов и территорий, чтобы карта не была белой без сети.
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'Чистый берег',
				short_name: 'Чистый берег',
				description: 'Находим загрязнения из космоса. Убираем ногами.',
				theme_color: '#0f172a',
				background_color: '#0f172a',
				display: 'standalone',
				start_url: '/map',
				icons: [
					{ src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
					{ src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
				]
			},
			workbox: {
				importScripts: ['/sw-sync.js'],
				globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
				runtimeCaching: [
					{
						// Спутниковые тайлы Esri — самый тяжёлый и самый нужный офлайн ресурс.
						urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*\/tile\//,
						handler: 'CacheFirst',
						options: {
							cacheName: 'map-tiles-satellite',
							expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 }
						}
					},
					{
						urlPattern: /^https:\/\/[abc]\.basemaps\.cartocdn\.com\/light_only_labels\//,
						handler: 'CacheFirst',
						options: {
							cacheName: 'map-tiles-labels',
							expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 }
						}
					},
					{
						// Территории и точки — тот самый «карта не белая офлайн»:
						// stale-while-revalidate отдаёт вчерашний снимок сразу же,
						// обновляясь при первой возможности.
						urlPattern: /\/data\/(territories|reports)\.json$/,
						handler: 'StaleWhileRevalidate',
						options: { cacheName: 'app-data' }
					}
				]
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		passWithNoTests: true,
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
