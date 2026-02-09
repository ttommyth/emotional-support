import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// For GitHub Pages, use the repository name from the environment or default to the repo name
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'emotional-support';
const isGitHubPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
	plugins: [react()],
	base: isGitHubPages ? `/${repoName}/` : './',
	define: {
		// Expose GITHUB_PAGES flag to the client code at build time
		// For dev mode, this will be false, and we use import.meta.env.VITE_GITHUB_PAGES instead
		__GITHUB_PAGES__: JSON.stringify(isGitHubPages)
	},
	build: {
		rollupOptions: {
			input: {
				main: './index.html',
				control: './control.html'
			}
		}
	}
});
