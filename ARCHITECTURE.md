# Architecture

How the Emotional Support extension is structured. This describes the **current** state (post 2026-08-15 refactor). For the historical refactor plan, see `docs/architecture-refactor.md`.

---

## 1. Big picture

There are **two separately-bundled roots** plus one standalone process. They cannot share source files without build changes:

| Runtime | Entry points | Bundler | Output |
|---|---|---|---|
| Extension host (`src/`) | `src/extension.ts` | esbuild (CJS, Node) + `tsc` | `dist/extension.js` |
| MCP server (`src/`) | `src/mcp-server.ts` | esbuild (same entry list) | `dist/mcp-server.js` |
| Webview (`webview-ui/src/`) | `main.tsx` + `control-main.tsx` | Vite | `webview-ui/dist/` |

```mermaid
graph TD
  subgraph src (Node)
    EXT[extension.ts — thin wiring]
    EXT --> CMDS[commands.ts]
    EXT --> MCPREG[mcp-registration.ts]
    EXT --> MON[window-monitor.ts]
    EXT --> VIBE[vibe-reactions.ts]
    EXT --> SRV[services/]
    EXT --> HOOKS[hooks/cursor-hook-bridge.ts]
    MCP[s mcp-server.ts] --> PROTO[bridge/mcp-protocol.ts]
    MCP --> DOM[domain/actions.ts]
    BRIDGE[bridge/mcp-bridge.ts] --> PROTO
    EXT --> BRIDGE
  end
  subgraph webview-ui/src (browser)
    APP[app/App.tsx — React shell]
    APP --> SCENE[app/RobotScene.ts — RobotScene class]
    SCENE --> CTX[robot/scene-context.ts]
    SCENE --> AUTO[robot/autopilot.ts]
    SCENE --> INTER[robot/interaction.ts]
    SCENE --> RENDER[render/render-loop.ts]
    SCENE --> MSG[messaging/message-handler.ts]
    CP[control-panel/ControlPanel.tsx] --> CPROTO[control-panel/control-protocol.ts]
  end
  EXT -.postMessage.-> APP
  MCP -.file bridge.-> BRIDGE
```

---

## 2. Directory layout

### Extension host — `src/`

```
src/
  extension.ts                  ← activation + DI wiring only (~150 lines)
  commands.ts                   ← all registerCommand() calls
  mcp-registration.ts           ← registerMcpServerDefinitionProvider
  window-monitor.ts             ← WindowFocusMonitor (wind-down FSM)
  vibe-reactions.ts             ← VibeReactionController
  domain/actions.ts             ← canonical PET_ACTIONS, SCENE_PROP_TYPES, SCENE_POSITIONS
  services/
    pet-mood-service.ts         ← PetMoodService (mood ingestion)
    workspace-vibe-service.ts   ← WorkspaceVibeService + vibeLevel()
    mood-interpreter.ts         ← MoodInterpreter (heuristic personality reactions)
    mood-history-service.ts     ← MoodHistoryService (session summary/telemetry)
  hooks/cursor-hook-bridge.ts   ← Cursor hook file watcher
  bridge/
    mcp-protocol.ts             ← shared protocol types (RobotControlCommand, …)
    mcp-bridge.ts               ← McpBridge (watches command file, publishes state)
    mcp-server.ts               ← standalone MCP stdio server (imports protocol + domain)
  webview/
    html.ts                     ← shared getHtmlForWebview() + CSP injection
    pet-view/PetViewProvider.ts ← main robot webview provider
    control-view/PetControlViewProvider.ts ← dev control panel provider
  test/                         ← Mocha (TDD) suites
```

### Webview — `webview-ui/src/`

```
webview-ui/src/
  main.tsx / control-main.tsx / AppWithControlPanel.tsx   ← entries + GitHub Pages shell
  app/
    App.tsx                  ← thin React shell (71 lines)
    RobotScene.ts            ← RobotScene class: scene graph + all mutable state + handlers
  robot/
    types.ts                 ← RobotActionName, RobotTargets, ScenePropType, … (canonical mirror)
    scene-context.ts         ← RobotSceneContext interface (shared state contract)
    autopilot.ts             ← updateAI(ctx, delta) — idle/move/perform FSM
    interaction.ts           ← interaction + cleanup + thrown-prop state machines
    action-labels.ts         ← ACTION_ORDER / ACTION_DISPLAY (control-panel display)
    actions/                 ← one file per action (idle, coding, wave, …) + helpers/props/eyes
    scene-props.ts           ← ground scene-props manager + mesh builders
  scene/
    setupScene.ts            ← camera/lights/ground/materials
    createRobotMesh.ts       ← robot geometry construction
  messaging/
    protocol.ts              ← ExtensionToWebViewMessage / WebViewToExtensionMessage unions
    message-handler.ts       ← RobotSceneController + handleMessage() router
  render/
    render-loop.ts           ← animate(ctx) + startRenderLoop(ctx)
    lerp.ts                  ← pure lerp helpers (normalizeRotation, lerpV/R, lerpAngle)
  control-panel/
    ControlPanel.tsx         ← dev-only control panel
    control-protocol.ts      ← panel message types (VibeData, SessionSummary, …)
```

---

## 3. Extension ↔ Webview messaging

`webview.postMessage` / `onDidReceiveMessage`. The message shapes are **typed** in `webview-ui/src/messaging/protocol.ts` and must match what the providers send.

| Direction | command | Key fields |
|---|---|---|
| ext → web | `SET_MOOD` | `mood: PetAction`, `message?`, `durationSeconds?`, `temperature?` |
| ext → web | `SET_AUTOPILOT` | `enabled: boolean` |
| ext → web | `SET_TEMPERATURE` | `temperature` |
| ext → web | `FORCE_MOVE` | `target: 'front' \| 'left' \| 'right'` |
| ext → web | `SET_SCENE` | `props: ScenePropCommandEntry[]` |
| ext → web | `PLACE_SCENE_PROP` | `propId`, `propType`, `position?`, `autoInteract?`, `durationSeconds?`, `finishBehavior?` |
| ext → web | `REMOVE_SCENE_PROP` | `propId` |
| ext → web | `INTERACT_WITH_PROP` | `propId`, `durationSeconds?` |
| ext → web | `INTERACT_CLOSEST_PROP` | — |
| ext → web | `SET_CONFIG` | all `emotional-support.*` settings |
| ext → web | `SHOW_TOAST` | `text` |
| web → ext | `READY` | — |
| web → ext | `SET_MOOD` | `mood` |

**When adding a message type**: update `PetViewProvider.resolveWebviewView` (or the control provider), the `RobotSceneController` interface + `handleMessage` in `message-handler.ts`, and the `protocol.ts` unions.

---

## 4. MCP bridge (file-based)

The extension and the MCP server communicate via JSON files in the extension's `globalStorageUri`:

- `mcp-robot-command.json` — MCP server writes commands.
- `mcp-robot-state.json` — extension writes current state.

`RobotControlCommand` is a discriminated union on `type`:
`'setMood' | 'setAutopilot' | 'forceMove' | 'setScene' | 'placeSceneProp' | 'removeSceneProp' | 'interactWithProp'`.

- `bridge/mcp-protocol.ts` holds the shared types (imported by both the extension and the standalone server — it must stay **`vscode`-free**).
- `bridge/mcp-bridge.ts` — `McpBridge` class watches the command file and forwards to a `RobotControlTarget` (the pet view provider).
- `mcp-server.ts` is registered via `vscode.lm.registerMcpServerDefinitionProvider` and launched with `EMOTIONAL_SUPPORT_BRIDGE_DIR` set to the extension's global storage.

---

## 5. Robot scene — the shared-context design

The webview's heavy lifting lives in the **`RobotScene` class** (`webview-ui/src/app/RobotScene.ts`), which implements two interfaces:

- **`RobotSceneContext`** (`robot/scene-context.ts`) — all shared mutable state (scene graph refs, AI state, interaction state, locomotion, tunables) plus leaf behaviors (`setRobotAction`, `getFacingDot`, `isRobotAction`, `resetTargets`, `resolveActionTransition`).
- **`RobotSceneController`** (`messaging/message-handler.ts`) — the webview message handlers (`applyConfig`, `setMood`, `setScene`, …).

The per-frame subsystems are **extracted modules operating on the context**:

| Module | Responsibility |
|---|---|
| `robot/autopilot.ts` | `updateAI(ctx, delta)` — the 3-state FSM (IDLE → MOVING → PERFORMING), trip logic, locomotion tiering |
| `robot/interaction.ts` | `startInteraction`/`updateInteraction`, `startCleanup`/`updateCleanup`, `launchThrownProp`/`updateThrownProp` |
| `render/render-loop.ts` | `animate(ctx)` (self-rescheduling via rAF), blink, eye color, thought-bubble projection |
| `messaging/message-handler.ts` | routes inbound messages to controller methods |

The React component (`App.tsx`) is a thin shell: it calls `setupRobotScene(opts)` and returns a cleanup function.

---

## 6. Action system

Actions live in `webview-ui/src/robot/actions/`. Use `defineAction()` from `helpers.ts` for actions with props; plain `RobotActionDefinition` for actions without.

- **Tags**: `work`, `idleLike`, `idleFiller`, `movement`, `sleep`, `restPose`, `blocksAutoLookAt`, `blocksBlink`, `skipPost`.
- **Transitions**: optional `pre`/`post` with durations; the loop runs `pre → main → post`.
- **Eye colors**: `'cyan' | 'red' | 'green' | 'off' | 'purple' | 'calm'`, resolved in `actions/eyes.ts`.
- **Props**: the **dynamic Map-based registry** (`robot/actions/props.ts`) is auto-populated from actions that declare a `prop` field. Lifecycle: `hidden → held → dropping → ground → hidden (fade)`.
- **Anchor presets** (`helpers.ts`): `frontHeld`, `leftHand`, `rightHand`, `aboveHead`, `headRight`.

### Adding a new action (canonical checklist)

1. Add to `PET_ACTIONS` in `src/domain/actions.ts`.
2. Add to the `RobotActionName` union in `webview-ui/src/robot/types.ts`.
3. Create `webview-ui/src/robot/actions/<name>.ts` (via `defineAction()` if it has a prop).
4. Register it in the `allActions` array in `webview-ui/src/robot/actions/index.ts`.
5. The consistency guard in `src/test/action-consistency.test.ts` verifies steps 1–2.

---

## 7. Scene props system

Ground props placed independently of the robot (`robot/scene-props.ts`, types in `robot/types.ts`).

- **Types**: `paper`, `laptop`, `magnifying_glass`, `clipboard`, `wrench`, `test_tubes`, `lightbulb`, `book` (interactive), `coffee_mug`, `star`, `trophy` (decoration).
- **Mapping**: `SCENE_PROP_ACTION_MAP` maps interactive prop → robot action on pickup.
- **Lifecycle**: `spawning → idle → targeted → grabbed → (removed)` or `spawning → idle → despawning → (removed)`.
- **Interaction pipeline**: `walking → bending → grabbing → rising` then the mapped action with MCP override.

---

## 8. Configuration

All settings live under `emotional-support.*` in `package.json` `contributes.configuration`. Adding a setting touches three places:

1. `contributes.configuration.properties` in `package.json`.
2. `PetViewProvider.getConfig()` in `src/webview/pet-view/PetViewProvider.ts`.
3. The `SET_CONFIG` handler in `RobotScene.applyConfig()`.

---

## 9. Cursor hook bridge

`CursorHookBridge` (`src/hooks/cursor-hook-bridge.ts`) watches for `emotional-support-event.json` files written by Cursor hooks (per-workspace `.cursor/hooks/` and global-storage event directories). Sample hook scripts live in `hooks-samples/`.

---

## 10. Consistency between the two roots

Because the extension and webview are bundled separately, the canonical vocabulary is mirrored and guarded:

- Extension: `src/domain/actions.ts` → `PET_ACTIONS`, `SCENE_PROP_TYPES`, `SCENE_POSITIONS`.
- Webview: `webview-ui/src/robot/types.ts` → `RobotActionName`, `ScenePropType`.

`src/test/action-consistency.test.ts` reads the webview types **as source text** and asserts the two sets match, so drift is caught at test time.
