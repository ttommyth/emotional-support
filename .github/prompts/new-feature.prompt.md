# Plan a New Feature

Use this prompt when planning a new feature for the Emotional Support extension. It helps break down the work into the right files and layers.

## Feature Planning Checklist

Answer these questions to scope the work:

1. **What does the feature do?** (one sentence)
2. **Which layers are involved?**
   - [ ] Extension host (`src/`)
   - [ ] Webview / 3D scene (`webview-ui/`)
   - [ ] MCP server (`src/mcp-server.ts`)
   - [ ] Cursor hooks (`hooks-samples/`)
   - [ ] Configuration (`package.json` settings)
3. **Does it add a new robot action?** → See `add-robot-action` prompt
4. **Does it add a new VS Code command?** → See `add-extension-command` prompt
5. **Does it need extension↔webview messaging?** → See `webview-messaging` prompt
6. **Does it need new settings?** → See `add-configuration` prompt
7. **Does it need a new MCP tool?** → See `add-mcp-tool` prompt
8. **Does it need a new Cursor hook event?** → See `add-cursor-hook` prompt

## Implementation Order

When a feature spans multiple layers, implement in this order:

1. **Types first** — Define types, interfaces, action names, command shapes
2. **Extension host** — Wire up commands, settings, bridge handlers
3. **Webview** — Implement the 3D behavior, message handling, new actions
4. **MCP / Hooks** — Add external integration points last
5. **Tests** — Add or update tests in `src/test/`

## Key Files by Concern

| Concern | Files |
|---|---|
| Action definitions | `src/pet-mood-service.ts`, `webview-ui/src/robot/types.ts`, `webview-ui/src/robot/actions/` |
| Extension commands | `package.json`, `src/extension.ts` |
| Settings | `package.json`, `src/extension.ts` (`getConfig`), `webview-ui/src/App.tsx` |
| Webview messaging | `src/extension.ts` (`PetViewProvider`), `webview-ui/src/App.tsx` |
| MCP tools | `src/mcp-server.ts`, `src/mcp-bridge.ts` |
| Cursor hooks | `hooks-samples/user-emotional-support-hook.js`, `src/cursor-hook-bridge.ts` |
| Focus/unfocus | `src/extension.ts` (`handleWindowStateChange`, unfocused behavior cycle) |
| Autopilot AI | `webview-ui/src/App.tsx` (FSM: `IDLE → MOVING → PERFORMING`) |
| Props | `webview-ui/src/robot/actions/props.ts`, individual action files |
| Eye colors | `webview-ui/src/robot/actions/eyes.ts`, `webview-ui/src/robot/types.ts` |

## Quality Checklist

Before submitting:

- [ ] `npm run check-types` passes (both tsconfigs)
- [ ] `npm run lint` passes
- [ ] `npm run compile` succeeds (full build)
- [ ] Tested in Extension Development Host (F5)
- [ ] No synchronous file I/O in extension activation path
- [ ] All VS Code disposables pushed to `context.subscriptions`
- [ ] Webview HTML has proper CSP headers
- [ ] No `vscode` imports in `mcp-server.ts`
- [ ] `PET_ACTIONS`, `RobotActionName`, and `robotActions` map are in sync
