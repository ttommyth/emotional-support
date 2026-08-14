# AGENTS.md

Guidance for AI coding agents working in this repository (and for humans who want the same condensed facts). If you're an agent reading this, read the whole file before making changes.

This file complements, and defers to, the deeper `.github/copilot-instructions.md` and `ARCHITECTURE.md`. When in doubt, follow those.

---

## Repo at a glance

A **VS Code extension** (`publisher: problemsofa`) that renders an interactive 3D robot companion in a sidebar webview. It reacts to developer activity, MCP tool calls, Cursor hooks, and window focus.

Two **separately-bundled** roots:

| Root | Stack | Bundler |
|---|---|---|
| `src/` (extension host) | TS + VS Code API, ES2022/Node16 | esbuild (CJS, Node) → `dist/` |
| `src/mcp-server.ts` | standalone MCP stdio server | esbuild (same entries) → `dist/mcp-server.js` |
| `webview-ui/src/` | React 18 + Three.js + Vite, ES2022/bundler | Vite → `webview-ui/dist/` |

They **cannot share source files** without build changes; the canonical vocabulary is mirrored and guarded by tests.

## Build / test commands (Windows)

```powershell
$env:PATH = "C:\nvm4w\nodejs;" + $env:PATH   # nvm-windows — node is NOT on PATH by default
npm install
npm --prefix webview-ui install
npm run compile            # full: webview + tsc + lint + esbuild
npm run check-types        # tsc --noEmit (extension src)
npm run lint               # eslint src
npm --prefix webview-ui run build   # webview tsc + vite
npm run compile-tests && npm run test  # Mocha suite in a VS Code host (45 tests)
```

**F5** launches the Extension Development Host.

## Rules of thumb for agents

1. **Mirror the canonical action list** — `PET_ACTIONS` (`src/domain/actions.ts`) must stay in sync with `RobotActionName` (`webview-ui/src/robot/types.ts`). The `action-consistency.test.ts` guard fails if they drift. Same for `SCENE_PROP_TYPES` ↔ `ScenePropType`.
2. **Keep `mcp-server.ts` free of `vscode`** — it runs as a standalone Node process. Shared protocol types live in `src/bridge/mcp-protocol.ts`.
3. **No `enum`** — use `as const` arrays + derived unions. Strict TS in both tsconfigs.
4. **No sync file I/O in `activate()`** — the activation path must stay light.
5. **Push disposables to `context.subscriptions`** and clear timers on `dispose()`. Watch the output-channel gotcha (see below).
6. **Webview: no direct DOM manipulation** — use the Three.js scene graph. Actions are target-based (set targets; the loop lerps).
7. **Adding a webview message**: update `PetViewProvider` + `RobotSceneController`/`message-handler.ts` + `messaging/protocol.ts` together.
8. **Tests are Mocha TDD UI** — use `suite()`/`test()` + `setup()`/`teardown()`. `beforeEach`/`afterEach` throw.
9. **Don't add heavy npm deps to the extension** (bundle size matters).

## Architecture in one paragraph

`src/extension.ts` is thin wiring: it builds a `PetViewProvider` (+ `McpBridge`, `WorkspaceVibeService`, `VibeReactionController`, `WindowFocusMonitor`), registers commands (`commands.ts`) and the MCP server (`mcp-registration.ts`). The webview is a thin `App.tsx` shell delegating to the **`RobotScene` class** (`webview-ui/src/app/RobotScene.ts`), which implements `RobotSceneContext` (`robot/scene-context.ts`) and `RobotSceneController` (`messaging/message-handler.ts`); per-frame logic is extracted into `robot/autopilot.ts`, `robot/interaction.ts`, and `render/render-loop.ts`.

Full detail: **ARCHITECTURE.md** (root) and **.github/copilot-instructions.md**.

## Known gotchas (verified in this repo)

- **Output channel must be created eagerly** in `activate()` (`context.subscriptions.push(getOutputChannel())`). The lazy `getOutputChannel()` singleton, if first called from a late async callback after disposal, triggers VS Code's `Trying to add a disposable to a DisposableStore that has already been disposed of` error. (The same error can come from **other installed extensions** or the VS Code 1.133 framework bug microsoft/vscode#232559 — check for a stale installed copy of this extension in `%USERPROFILE%\.vscode\extensions` before debugging.)
- **Stale duplicate install**: if an old `problemsofa.emotional-support` copy is installed, it loads alongside the F5 dev copy. Uninstall it; folder removal completes on window reload.
- **nvm-windows PATH**: `node`/`npm` are not on PATH in automated terminals — prepend `C:\nvm4w\nodejs`.

## Docs index

- [ARCHITECTURE.md](ARCHITECTURE.md) — structure & message protocol
- [DEVELOPMENT.md](DEVELOPMENT.md) — setup/build/test/debug
- [CONTRIBUTING.md](CONTRIBUTING.md) — contribution workflow
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [ROADMAP.md](ROADMAP.md) — planned work
- `.github/copilot-instructions.md` — detailed conventions (actions, props, messaging)
- `docs/architecture-refactor.md` — historical refactor plan
- `docs/robot-lifecycle.md` — robot action/lifecycle deep-dive
- `.notes/` — early design notes + status updates
