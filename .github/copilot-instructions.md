# Emotional Support — Copilot Project Instructions

## Project Overview

**Emotional Support** is a VS Code extension (TypeScript) that renders an interactive 3D robot companion in a sidebar webview panel. The robot reacts to developer activity, MCP tool calls, Cursor hooks, and window focus events. It is published under the `problemsofa` publisher.

## Repository Layout

```
src/                      ← Extension host code (Node / VS Code API)
  extension.ts            ← activate(), commands, webview providers, focus monitor
  mcp-bridge.ts           ← File-based bridge between MCP server ↔ extension
  mcp-server.ts           ← Standalone MCP stdio server (separate esbuild entry)
  pet-mood-service.ts     ← PetAction type, PetMoodPayload, PetMoodService class
  cursor-hook-bridge.ts   ← Watches Cursor hook event files and forwards moods
  test/                   ← Mocha + @vscode/test-electron tests

webview-ui/               ← Vite + React + Three.js webview app
  src/App.tsx             ← Main scene: 3D robot, action state machine, autopilot AI
  src/robot/types.ts      ← RobotActionName, RobotActionDefinition, RobotTargets, tags
  src/robot/actions/      ← One file per action (idle.ts, coding.ts, wave.ts …)
  src/robot/actions/index.ts  ← robotActions map, actionHasTag(), getActionsByTag()
  src/robot/actions/props.ts  ← Prop lifecycle (create, update, drop, ground, fade)
  src/robot/actions/eyes.ts   ← Eye-color resolution from RobotEyeColorName
  src/control-panel/      ← Dev-only control panel webview

hooks-samples/            ← Sample Cursor hook scripts for user installation
docs/                     ← Supplementary documentation (robot-lifecycle.md)
media/                    ← Icons and static assets
```

## Tech Stack

| Layer | Stack |
|---|---|
| Extension host | TypeScript, VS Code Extension API (^1.105), esbuild (CJS, Node platform) |
| MCP server | `@modelcontextprotocol/sdk`, zod v4, stdio transport, separate esbuild entry |
| Webview UI | React 18, Three.js, Vite, TypeScript (ESNext/bundler) |
| Testing | Mocha, `@vscode/test-cli`, `@vscode/test-electron` |
| Linting | ESLint 9 + typescript-eslint |

## Build & Run

```bash
npm install                   # extension deps
npm --prefix webview-ui install  # webview deps
npm run compile               # full build (webview + types + lint + esbuild)
npm run watch                 # watch mode (esbuild + tsc --noEmit in parallel)
npm run build:webview         # webview only
# Press F5 to launch Extension Development Host
```

esbuild has **two entry points**: `src/extension.ts` and `src/mcp-server.ts`, both output to `dist/`.

## Architecture Conventions

### Extension ↔ Webview Messaging

Communication uses `webview.postMessage` / `onDidReceiveMessage`. Message shapes:

| Direction | command | Key fields |
|---|---|---|
| ext → web | `SET_MOOD` | `mood: PetAction`, `message?`, `durationSeconds?` |
| ext → web | `SET_AUTOPILOT` | `enabled: boolean` |
| ext → web | `FORCE_MOVE` | `target: 'front' \| 'left' \| 'right'` |
| ext → web | `SET_CONFIG` | All config fields from `emotional-support.*` settings |
| web → ext | `READY` | (none) |
| web → ext | `SET_MOOD` | `mood`, `message` |

When adding a new message type, update both `PetViewProvider.resolveWebviewView` in extension.ts and the `handleMessage` logic in App.tsx.

### MCP Bridge (File-Based)

The MCP server and extension communicate via JSON files in `globalStorageUri`:
- `mcp-robot-command.json` — MCP server writes commands
- `mcp-robot-state.json` — Extension writes current state

`RobotControlCommand` is a discriminated union on `type`: `'setMood' | 'setAutopilot' | 'forceMove'`.

### Action System

Each action in `webview-ui/src/robot/actions/` exports a `RobotActionDefinition`:

```ts
{
  name: RobotActionName;
  apply: (time, context) => void;        // Per-frame target-setting
  update?: (delta, time, context) => void; // Per-frame side effects
  pre?: RobotActionTransition;            // Entry transition
  post?: RobotActionTransition;           // Exit transition
  tags?: RobotActionTag[];                // Categorization
  eyeColor?: RobotEyeColorName;          // Eye color for this action
}
```

**Tags**: `work`, `idleLike`, `idleFiller`, `movement`, `sleep`, `restPose`, `blocksAutoLookAt`, `blocksBlink`, `skipPost`.

### Pet Actions (Canonical List)

The canonical list lives in `src/pet-mood-service.ts` as `PET_ACTIONS`. The webview `RobotActionName` type in `types.ts` must mirror it exactly. When adding a new action:
1. Add to `PET_ACTIONS` array in `pet-mood-service.ts`
2. Add to `RobotActionName` union in `webview-ui/src/robot/types.ts`
3. Create `webview-ui/src/robot/actions/<name>.ts`
4. Register in `webview-ui/src/robot/actions/index.ts`

### Props System

Props are 3D objects tied to action names. See `props.ts` for the `PropState` type and lifecycle: `hidden → held → dropping → ground → hidden (fade)`. Work actions typically have associated props.

### Eye Colors

`RobotEyeColorName`: `'cyan' | 'red' | 'green' | 'off' | 'purple' | 'calm'`. Resolved in `eyes.ts`. Configurable overrides via `emotional-support.defaultEyeColor`, `successEyeColor`, `errorEyeColor` settings.

### Configuration

All settings live under the `emotional-support.*` namespace in `package.json` `contributes.configuration`. When adding a new setting:
1. Add to `contributes.configuration.properties` in `package.json`
2. Read it in `PetViewProvider.getConfig()` in `extension.ts`
3. Handle it in the webview `SET_CONFIG` message handler in `App.tsx`

### Cursor Hook Bridge

`CursorHookBridge` watches for `emotional-support-event.json` files written by Cursor hooks. Hook scripts live in `hooks-samples/`. The bridge supports both per-workspace `.cursor/hooks/` and global storage event directories.

## Coding Standards

- **TypeScript strict mode** in both tsconfigs
- Extension code targets **ES2022 / Node16** module resolution
- Webview code targets **ES2022 / ESNext** with bundler module resolution
- Use `type` imports (`import type { ... }`) where possible
- Prefer `const` assertions and discriminated unions over enums
- All VS Code disposables must be pushed to `context.subscriptions`
- Webview HTML is generated by reading the Vite build output from `webview-ui/dist/` and injecting CSP headers
- No direct DOM manipulation in webview — use Three.js scene graph
- Actions use **target-based animation**: set target positions/rotations each frame, the main loop lerps toward them

## Important Patterns

- The extension uses **exponential backoff** for unfocused behavior scheduling
- Autopilot AI in the webview uses a 3-state FSM: `IDLE → MOVING → PERFORMING`
- MCP override (`mcpOverrideActive`) takes priority and skips post transitions
- `disabledActions` config filters actions from autopilot and unfocused pools
- The MCP server definition is registered via `vscode.lm.registerMcpServerDefinitionProvider`
- The `EMOTIONAL_SUPPORT_BRIDGE_DIR` env var connects the MCP server process to the extension's global storage

## What NOT to Do

- Don't add synchronous file I/O in the extension activation path
- Don't import `vscode` in `mcp-server.ts` (it runs as a standalone Node process)
- Don't modify `PET_ACTIONS` without updating `RobotActionName` and vice versa
- Don't use `enum` — use `as const` arrays and derived union types
- Don't add heavy npm dependencies to the extension (bundle size matters)
- Don't skip CSP headers when generating webview HTML