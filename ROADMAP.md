# Roadmap

The current state, what's shipping soon, and where the project could go. Roadmap items are ideas, not commitments — they evolve with feedback and interest.

**Current version:** 0.0.6 · **License:** MIT

---

## Where we are (done)

The 2026-08-15 refactor completed the core architecture:

- ✅ **10-phase modular refactor** — `src/extension.ts` 945 → ~150 lines; `webview-ui/src/App.tsx` 1640 → 71 lines; the scene logic extracted into a `RobotScene` class + focused modules (`autopilot`, `interaction`, `render-loop`, `message-handler`, `scene-context`).
- ✅ **Canonical domain vocabulary** — `src/domain/actions.ts` mirrors the webview `RobotActionName`, guarded by a consistency test.
- ✅ **45 passing tests** — services, MCP bridge, window-focus monitor, cross-root consistency.
- ✅ **MCP server** — AI agents can drive the robot (`set_robot_action`, scene props, etc.).
- ✅ **Cursor hook bridge** — reacts to IDE/agent events.
- ✅ **GitHub Pages demo** — https://ttommyth.github.io/emotional-support/

## Near term (0.1.x)

Polishing the current foundation:

- [ ] **Webview test harness** — there is currently no automated test runner for the webview modules (three.js/React). A vitest setup with a JSDOM/headless-gl shim would let us unit-test `autopilot`, `interaction`, and `render-loop` logic.
- [ ] **Complete `ACTION_ORDER`** and derive it from the canonical union at compile time (currently a hard-coded array + guard test).
- [ ] **Release automation** — finalize the `publish-vscode` GitHub workflow end-to-end (build → package → publish → tag).
- [ ] **Better error surfacing** — move the "DisposableStore already disposed" / other extension-host noise handling into a documented, testable utility.

## Mid term (0.2.x)

Deeper interactivity and AI integration:

- [ ] **LLM-backed reactions (optional provider)** — the original design called for a "Workspace Status Interpreter." Today `MoodInterpreter` is a deterministic heuristic. Add an optional provider (e.g. via `vscode.lm` or a BYO-API-key setting) that turns the `WorkspaceVibe` into richer, personality-tuned reactions with a deterministic fallback.
- [ ] **More robot actions & props** — the action system makes new animations cheap; prioritize by community demand.
- [ ] **Scene-prop polish** — interactions beyond pickup (e.g. robot placing a prop on a desk, multi-prop routines).
- [ ] **Session telemetry UI** — a mood graph/panel showing stress over time (the data is already tracked in `MoodHistoryService`).

## Far term (0.3+ / experimental)

- [ ] **Team "vibe" file** — broadcast workspace status to a shared file (e.g. `.vscode/team-mood.json`) so the robot can comment on project health, not just the user's.
- [ ] **Kiro / other agent hook support** — beyond Cursor, bridge other agent IDEs into the hook system.
- [ ] **Custom robot appearance** — themeable colors/accessories via settings (the material/color system already supports recoloring).
- [ ] **Mobile/web demo parity** — ensure the GitHub Pages demo stays feature-complete with the extension.

## Non-goals

- No data collection/telemetry sent anywhere without explicit opt-in.
- No external LLM calls unless the user configures a provider (privacy by default).

---

Contributions toward any roadmap item are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). If you'd like to propose a change to the roadmap, open an issue or PR.
