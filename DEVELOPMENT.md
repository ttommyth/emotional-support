# Development Guide

Everything you need to build, run, test, and debug the Emotional Support extension locally.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | 22+ | Developed on Node 22. Other modern LTS versions generally work. |
| **npm** | 9+ | Ships with Node. |
| **VS Code** | 1.105+ | For the extension host. Cursor (forks) also work for the hook bridge. |

### Node via nvm-windows (Windows)

This repo is developed on Windows with **nvm-windows**. Important detail: in **automated terminal sessions**, `node`/`npm` are **not** on `PATH` by default. Prepend the active version first:

```powershell
$env:PATH = "C:\nvm4w\nodejs;" + $env:PATH
```

`npm postinstall` scripts (e.g. `@parcel/watcher`) fail with `'node' is not recognized` unless `PATH` is set.

## Install

```bash
# extension dependencies
npm install

# webview dependencies (separate package.json under webview-ui/)
npm --prefix webview-ui install
```

## Build

| Command | What it does |
|---|---|
| `npm run compile` | Full build: webview (`build:webview`) + `check-types` + `lint` + esbuild |
| `npm run build:webview` | Builds only the webview (`tsc && vite build` in `webview-ui/`) |
| `npm run check-types` | `tsc --noEmit` for the extension `src/` |
| `npm run watch` | Watch mode — esbuild + `tsc --noEmit` in parallel |
| `npm --prefix webview-ui run build` | Webview only (`tsc && vite build`) |
| `npm run lint` | ESLint over `src/` |
| `npm run package` | Production build → `.vsix` (builds webview, check-types, lint, esbuild `--production`) |

### esbuild entries

esbuild has **two entry points** (see `esbuild.js`), both output to `dist/`:

- `src/extension.ts` → `dist/extension.js` (the extension host)
- `src/mcp-server.ts` → `dist/mcp-server.js` (the standalone MCP stdio server)

## Run (F5)

1. `npm install` and `npm --prefix webview-ui install` (first time only).
2. `npm run compile` (or leave `npm run watch` running).
3. Press **F5**.
4. The Extension Development Host opens. Find the **Emotional Support** view in the Explorer sidebar (activity bar icon).

### Launch configurations

`.vscode/launch.json` provides two configs:

- **Run Extension** — standard F5 with the workspace extension.
- **Run Extension (isolated — no other extensions)** — adds `--disable-extensions` to prove whether a runtime error is caused by this extension or by other installed extensions.

## Test

Tests run inside a real VS Code extension host (`@vscode/test-cli`):

```bash
npm run compile-tests   # tsc src/test → out/test
npm run test            # vscode-test (uses .vscode-test.mjs → out/test/**/*.test.js)
```

- First run downloads and caches VS Code into `.vscode-test/` (a few minutes).
- Mocha uses the **TDD UI**: `suite()` / `test()` with `setup()` / `teardown()`. Do **not** use `beforeEach`/`afterEach` — they throw `ReferenceError: beforeEach is not defined`.
- The suite currently has **45 passing tests** across 7 files (services, MCP bridge, window-focus monitor, and the cross-root action-vocabulary consistency guard).

## Debug

- **Extension host**: F5 attaches the debugger to `dist/**/*.js` (`outFiles` in `launch.json`). Set breakpoints in `src/` (source maps enabled).
- **Webview**: open the webview panel, then use **Developer: Toggle Developer Tools** in the Extension Development Host to inspect the webview DOM/console.
- **MCP server**: it runs as a separate Node process. Debug by adding a second launch config with `"args": ["--extensionDevelopmentPath=...", "dist/mcp-server.js"]` if needed, or log via its stdout (prefixed `[mcp]`).

## Development workflow (fast loop)

```bash
# Terminal 1 — watch build (esbuild + tsc)
npm run watch

# Terminal 2 — watch tests
npm run watch-tests

# Edit src/ or webview-ui/src/, then F5 to try changes live.
```

When you change the webview, rebuild it (`npm run build:webview`) — the extension reads the built HTML/JS from `webview-ui/dist/` at runtime.

## Gotchas (learned the hard way)

1. **Output channel**: `getOutputChannel()` lazily creates `vscode.window.createOutputChannel`. It is created **eagerly at the top of `activate()`** — never move it later, or a late async callback can trigger VS Code's `DisposableStore already disposed` error.
2. **Stale installed copies**: if you've `vsce package`-installed the extension, an old copy may linger in `%USERPROFILE%\.vscode\extensions` and load alongside your F5 dev copy. Check for duplicates; uninstall via `code --uninstall-extension problemsofa.emotional-support`.
3. **Tests are TDD-mode Mocha** — see [Test](#test).
4. **Webview module isolation**: extension tests can't import webview modules (three.js lives only in `webview-ui/node_modules`). Cross-root consistency guards read webview source as text.

## See also

- [CONTRIBUTING.md](CONTRIBUTING.md) — contribution workflow and standards.
- [ARCHITECTURE.md](ARCHITECTURE.md) — how the code is structured.
- [ROADMAP.md](ROADMAP.md) — planned work.
