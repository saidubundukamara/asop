import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),

		// Don't auto-register the service worker in dev. Phase 1 ships the SW so
		// the manifest can pass Lighthouse installability, but stale SW caches
		// in dev cause "page won't update" confusion. Phase 8 wires production
		// registration deliberately.
		serviceWorker: {
			register: false
		}
	}
};

export default config;
