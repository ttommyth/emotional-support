/**
 * Headless runner for the action/prop sanity check.
 *
 * Bundles `src/review/sanity-check-cli.ts` with esbuild (resolved from the
 * repo root's node_modules — Vite's bundled esbuild also works) and executes
 * it in Node. No browser, no DOM, no renderer needed.
 *
 * Usage (from the webview-ui directory):
 *   node scripts/verify-actions.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

// Vite's bundler-mode resolution lets the source import three examples without
// a `.js` extension. Node-mode esbuild does not, so resolve them explicitly.
const threeExamplesPlugin = {
	name: 'three-examples-js',
	setup(build) {
		build.onResolve({ filter: /^three\/examples\/jsm\// }, (args) => {
			try {
				return { path: require.resolve(`${args.path}.js`, { paths: [args.resolveDir] }) };
			} catch {
				return { path: require.resolve(args.path, { paths: [args.resolveDir] }) };
			}
		});
	}
};

const here = dirname(fileURLToPath(import.meta.url));
const webviewRoot = resolve(here, '..');
const entry = join(webviewRoot, 'src', 'review', 'sanity-check-cli.ts');
const outfile = join(mkdtempSync(join(tmpdir(), 'es-sanity-')), 'check.mjs');

try {
	await build({
		entryPoints: [entry],
		bundle: true,
		platform: 'node',
		format: 'esm',
		target: 'node22',
		outfile,
		logLevel: 'warning',
		mainFields: ['module', 'main'],
		plugins: [threeExamplesPlugin]
	});
	// Importing the bundle runs the CLI (prints summary + JSON to stdout).
	await import(pathToFileURL(outfile).href);
} finally {
	rmSync(dirname(outfile), { recursive: true, force: true });
}
