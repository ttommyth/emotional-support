# Change Log

All notable changes to the "emotional-support" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.6] - 2026-08-15

### Added
- **Agent activity system** — the robot now reacts to what the coding agent is *actually doing* (no MCP server required). New `AgentActivityProvider` interface + `AgentReactionController` with pluggable providers:
  - `vscode-heuristics` — detects burst edits, file create/delete/rename, terminal test/build/debug commands, tasks, debug sessions, rapid doc opens, and new diagnostics after edits.
  - `copilot-tool` — native `lm.registerTool` (`emotionalSupport_react`) the agent can call explicitly.
  - `cursor-hooks` — forwards Cursor hook events to the controller.
  - Per-session arbitration, kind-based reactions (`thinking` `reading` `searching` `editing` `testing` `building` `debugging` `error` `done` `idle`), and rate limiting. Settings: `emotional-support.agentActivity.*`.
- **Dev review tooling** — `webview-ui/src/review/` sanity-check harness + `ReviewPanel`, `scripts/capture-review-shots.ps1` and `scripts/verify-actions.mjs`.
- Expanded test suite (45 tests): services, MCP bridge, window-focus monitor, agent reactions, and cross-root consistency.

### Changed
- **10-phase modular refactor** — `src/extension.ts` and `webview-ui/src/App.tsx` slimmed to thin wiring; scene logic extracted into the `RobotScene` class with focused modules (`autopilot`, `interaction`, `render-loop`, `message-handler`, `scene-context`).
- Canonical domain vocabulary — `src/domain/actions.ts` mirrors the webview `RobotActionName` (guarded by a consistency test).
- Refined `debugging`, `refactoring`, `rest`, and `shrug` animations; action `helpers` and prop lifecycle polish.
- Control panel and message protocol updated to match the refactored scene controller.
- Docs reorganized (`AGENTS.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `ROADMAP.md`).

### Fixed
- MCP bridge/server cleanups; `PET_ACTIONS` deduplicated into the shared domain module.

## [0.0.5] - 2026-02-22

### Added
- Initial marketplace release.
- 3D robot companion webview with interactive actions, props, and scene effects.
- MCP server so AI agents can drive the robot (`set_robot_action`, scene props, etc.).
- Cursor hook bridge for IDE/agent event reactions.
- GitHub Pages demo (https://ttommyth.github.io/emotional-support/).