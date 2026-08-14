# Contributing to Emotional Support

Thanks for your interest in contributing! This is a small, friendly project — a VS Code extension that renders a 3D robot companion in a sidebar webview. All contributions are welcome: bug fixes, new robot actions, docs, tests, and ideas.

Please take a moment to read this guide and the other docs before opening a PR.

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Project overview](#project-overview)
- [Getting started](#getting-started)
- [What to work on](#what-to-work-on)
- [Development workflow](#development-workflow)
- [Coding standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Opening a pull request](#opening-a-pull-request)
- [Release process](#release-process)

## Code of conduct

This project is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it. Be kind, be constructive, and assume good faith.

## Project overview

- **Extension host** (`src/`) — TypeScript + VS Code Extension API, bundled with esbuild (CJS, Node platform).
- **MCP server** (`src/mcp-server.ts`) — a standalone MCP stdio server (separate esbuild entry) that lets AI agents control the robot.
- **Webview UI** (`webview-ui/`) — a Vite + React 18 + Three.js app that renders the robot.

The two sides are **bundled separately** and communicate over `webview.postMessage`. The canonical architecture is described in [ARCHITECTURE.md](ARCHITECTURE.md).

## Getting started

Prerequisites:

- **Node.js 22+** (the repo is developed with Node 22; see [DEVELOPMENT.md](DEVELOPMENT.md) if you use nvm-windows).
- **VS Code** 1.105+ (or a fork like Cursor, for the hook bridge).
- A Windows/macOS/Linux shell with `npm`.

Setup:

```bash
npm install                     # extension dependencies
npm --prefix webview-ui install # webview dependencies
npm run compile                 # full build (webview + types + lint + esbuild)
```

Then press **F5** to launch the Extension Development Host. See [DEVELOPMENT.md](DEVELOPMENT.md) for the full workflow.

## What to work on

- **Good first issues / tasks**: bug fixes, missing tests, documentation, or a new simple robot action (each action is one file under `webview-ui/src/robot/actions/`).
- **New robot action**: follow the checklist in `.github/copilot-instructions.md` — add to `PET_ACTIONS` (`src/domain/actions.ts`), add to `RobotActionName` (`webview-ui/src/robot/types.ts`), create the action file, and register it in `webview-ui/src/robot/actions/index.ts`. The consistency test will catch drift.

If you're unsure what to pick, open an issue or ask — small, well-scoped PRs are preferred over large sweeping changes.

## Development workflow

1. Fork the repo and clone your fork.
2. Create a branch: `git checkout -b feat/your-feature`.
3. Make your changes (see [Coding standards](#coding-standards)).
4. Run the validation checks (see [Testing](#testing)) until everything is green.
5. Commit with a clear message.
6. Push and open a pull request against `main`.

Please keep PRs focused on a single concern. If a change spans many files, explain why in the PR description.

## Coding standards

- **TypeScript strict mode** in both `tsconfig.json` files.
- Extension code targets **ES2022 / Node16** module resolution; webview code targets **ES2022 / ESNext (bundler)**.
- Prefer `const` assertions and discriminated unions over `enum`. **No `enum`.**
- Use `type` imports (`import type { ... }`) where possible.
- Push all VS Code disposables to `context.subscriptions`.
- No direct DOM manipulation in the webview — use the Three.js scene graph.
- Actions use **target-based animation** (set targets each frame; the loop lerps toward them).
- Don't add heavy npm dependencies to the extension (bundle size matters).

The detailed conventions live in `.github/copilot-instructions.md` — read it before touching the action system, props, scene props, or messaging.

## Testing

Tests run inside a real VS Code extension host via `@vscode/test-cli`:

```bash
npm run compile-tests      # compile src/test → out/test
npm run test               # run the suite (vscode-test)
```

Conventions:

- Mocha **TDD UI** is used: `suite()` / `test()` with `setup()` / `teardown()` hooks. (`beforeEach`/`afterEach` are not available and will throw.)
- Tests must be **deterministic** — no fake timers; random selection is asserted via set membership.
- Cross-root consistency guards read webview source as text (regex), since webview modules can't be imported by extension tests.

Every contribution should keep the suite green (currently 45 passing tests). New modules are expected to come with tests when they contain pure, testable logic.

## Documentation

Docs live at the repo root (`README.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `ROADMAP.md`, `AGENTS.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`) and in `docs/` for deep-dive material. If you change behavior, update the relevant docs in the same PR.

## Opening a pull request

1. Make sure the branch is up to date with `main`.
2. Run the full validation once more:
   ```bash
   npm run check-types && npm run lint && npm run test
   npm --prefix webview-ui run build
   ```
3. Open the PR against `main` and describe:
   - what changed and why,
   - how you tested it,
   - any screenshots/GIFs for visual changes (very welcome for the robot!).
4. A maintainer will review. Keep the conversation constructive — review comments are about the code, not you.

## Release process

Releases are cut by maintainers:

1. Bump `version` in `package.json` (semver).
2. Update `CHANGELOG.md` under `[Unreleased]` → move to a dated release section.
3. Run `npm run package` to build the `.vsix`.
4. Publish via `vsce publish` (or the `publish-vscode` GitHub workflow if configured).
5. Tag the release in git.

---

Thank you for contributing! 🤖
