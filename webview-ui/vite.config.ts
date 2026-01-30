import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// For GitHub Pages, use the repository name from the environment or default to the repo name
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'emotional-support';

export default defineConfig({
	plugins: [react()],
	base: process.env.GITHUB_PAGES ? `/${repoName}/` : './',
	build: {
		rollupOptions: {
			input: {
				main: './index.html',
				control: './control.html'
			}
		}
	}
});
