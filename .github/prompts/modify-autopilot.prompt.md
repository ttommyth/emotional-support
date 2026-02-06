# Modify Autopilot Behavior

Adjust the autopilot AI that controls the robot's autonomous behavior in the webview.

## Autopilot Architecture

The autopilot lives in `webview-ui/src/App.tsx` and runs a 3-state FSM:

```
IDLE → MOVING → PERFORMING → IDLE
```

### States

- **IDLE**: Choose what to do next (move to random point, perform idle filler, or move to peek position)
- **MOVING**: Walk/run toward `moveTarget`, rotating to face direction of travel
- **PERFORMING**: Play an action for `aiTimer` seconds, then return to IDLE

### Key Variables (in App.tsx)

| Variable | Type | Purpose |
|---|---|---|
| `isAutoMode` | `boolean` | Master toggle (controlled by `SET_AUTOPILOT` message) |
| `aiState` | `'IDLE' \| 'MOVING' \| 'PERFORMING'` | Current FSM state |
| `aiTimer` | `number` | Countdown timer for current state |
| `moveTarget` | `Vector3 \| null` | Target position when moving |
| `mcpOverrideActive` | `boolean` | When true, MCP commands take priority over autopilot |

### Behavior Selection (IDLE state)

The autopilot randomly chooses between:
1. **Move to random point** — picks a random position in the scene
2. **Perform idle filler** — selects from actions tagged `idleFiller`
3. **Move to peek target** — walks to front-of-scene positions

Actions are filtered through `disabledActions` config.

### Scene Coordinates

- Camera is at (0, 3.6, 18), looking at (0, 2, 0)
- Ground plane at y = -4.8
- "Front" of scene: z > 8 (close to camera)
- Peek positions: left (-7, y, 10), right (7, y, 10), front (0, y, 12)

## Common Modifications

### Change movement speed
Adjust the speed calculation in the MOVING state. The `movementSpeed` config multiplier is applied on top.

### Add new autonomous behaviors
1. Add new tags to `RobotActionTag` in `webview-ui/src/robot/types.ts`
2. Tag appropriate actions
3. Use `getActionsByTag()` to select from the pool in the IDLE state

### Change timing
Adjust `aiTimer` values in the state transitions. The `animationSpeed` config multiplier affects animation playback speed.

### Add new FSM states
Add to the `aiState` type and implement the state logic in the animation loop's autopilot section.

## Guidelines

- The autopilot pauses when `mcpOverrideActive` is true (MCP commands have priority)
- Always filter through `disabledActions` when selecting random actions
- Use smooth transitions — avoid teleporting the robot (lerp toward targets)
- Movement uses yaw-wrapped angle lerp for natural turning
- The autopilot is disabled when the window is unfocused (extension sends `SET_AUTOPILOT false`)
