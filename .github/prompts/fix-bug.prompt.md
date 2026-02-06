# Debug and Fix a Bug

Structured approach for investigating and fixing bugs in the Emotional Support extension.

## Diagnostic Steps

### 1. Identify the layer

| Symptom | Likely layer | Key files |
|---|---|---|
| Extension doesn't activate | Extension host | `src/extension.ts`, `package.json` activationEvents |
| Robot doesn't appear | Webview build/HTML | `webview-ui/`, CSP headers in `getHtmlForWebview()` |
| Animation glitch | Action definition | `webview-ui/src/robot/actions/<action>.ts` |
| Action not recognized | Type mismatch | `PET_ACTIONS` vs `RobotActionName` vs `robotActions` map |
| MCP tool not working | MCP bridge | `src/mcp-server.ts`, `src/mcp-bridge.ts` |
| Config not applied | Settings pipeline | `package.json` → `getConfig()` → `SET_CONFIG` → `App.tsx` |
| Focus/unfocus stuck | Window monitor | `handleWindowStateChange` in `extension.ts` |
| Prop not showing | Props system | `props.ts`, action tags, `createRobotProps()` |

### 2. Check the output channel

The extension logs to the "Emotional Support" output channel. Run the command:
```
Emotional Support: Show Output
```

Key log prefixes:
- `[WindowMonitor]` — focus/unfocus events and timers
- `[CursorHookBridge]` — hook file events
- `[McpBridge]` — MCP command processing (check `mcp-bridge.ts`)

### 3. Check for type sync issues

The most common bug: `PET_ACTIONS` in `src/pet-mood-service.ts` is out of sync with `RobotActionName` in `webview-ui/src/robot/types.ts` or the `robotActions` map in `webview-ui/src/robot/actions/index.ts`. All three must list the exact same set of action names.

### 4. Check webview console

In the Extension Development Host, open the webview's DevTools:
- Command Palette → "Developer: Open Webview Developer Tools"
- Check for Three.js errors, missing props, or message handling issues

## Common Issues and Fixes

### Robot stuck in an action
- Check if `mcpOverrideActive` is stuck `true` in `App.tsx`
- Check if the action's `post` transition is blocking
- Look at `actionPhase` — it should cycle through `pre → main → post`

### Autopilot not working
- Verify `isAutoMode` is `true` (check `SET_AUTOPILOT` messages)
- Check `disabledActions` config — are all idle filler actions disabled?
- Look at `aiState` FSM: `IDLE → MOVING → PERFORMING`

### MCP server not connecting
- Check `EMOTIONAL_SUPPORT_BRIDGE_DIR` environment variable
- Verify the bridge directory exists and files are being written
- Check if `fs.watch` is firing (the bridge uses file-system watchers)

### Webview blank/broken
- Run `npm run build:webview` to rebuild the webview UI
- Check CSP headers in `getHtmlForWebview()`
- Verify `webview-ui/dist/` contains the built files

## Testing the Fix

1. `npm run check-types` — verify no TypeScript errors
2. `npm run lint` — verify no ESLint issues
3. `npm run compile` — full build
4. F5 → Extension Development Host → test the specific scenario
5. Run `npm test` if there are related test cases in `src/test/`
