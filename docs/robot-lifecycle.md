# Robot Lifecycle and Behaviors

## Architecture overview
- `src/extension.ts` manages focus/unfocus behavior and sends commands to the webview.
- `webview-ui/src/App.tsx` runs the 3D scene, animation loop, action state machine, autopilot AI, and message handling.
- `webview-ui/src/robot/actions/*` defines individual action poses and animations.
- `webview-ui/src/robot/actions/props.ts` manages prop spawning and cleanup tied to actions.

## Action taxonomy
- **Work actions** (`work` tag): `thinking`, `coding`, `debugging`, `reviewing`, `refactoring`, `testing`, `reading`, `success`, `error`.
- **Idle-like actions** (`idleLike` tag): `idle`, `stretch`, `lookaround`, `shrug`, `rest`, `sit`, `laydown`, `laydownflat`, `ballet`.
- **Idle filler actions** (`idleFiller` tag): `idle`, `stretch`, `lookaround`, `shrug`, `rest`, `sit`, `laydown`, `laydownflat`, `ballet`, `wave`, `dance`, `sleep`.
- **Movement actions** (`movement` tag): `walk`, `running`, `peek`, `ballet`.
- **Special flags**:
  - `blocksAutoLookAt`: `walk`, `running`, `peek`, `sleep`, `knocked`.
  - `blocksBlink`: `sleep`, `error`.
  - `skipPost`: `walk`, `running`.
  - `restPose`: `sit`, `laydown`, `laydownflat`, `rest`.

## Action state machine
- `currentAction`, `actionPhase` (`pre`/`main`/`post`), and `queuedAction` drive transitions in `webview-ui/src/App.tsx`.
- When switching actions, `post` transitions complete first unless `skipPost` is set or MCP override is active.
- `pre` transitions run when defined; otherwise actions start in `main`.

## Autopilot AI
- Controlled by `isAutoMode`, `aiState` (`IDLE`/`MOVING`/`PERFORMING`), and `aiTimer` in `webview-ui/src/App.tsx`.
- In `IDLE`, random choice determines whether to walk to a random point, perform an idle filler action, or walk to a peek target.
- In `MOVING`, robot walks or runs toward `moveTarget`, with speed and rotation based on distance and camera direction.
- On arrival at a peek target (front of scene), action switches to `peek` (side positions) or `wave` (center).
- In `PERFORMING`, `aiTimer` counts down before returning to `IDLE` and `idle` action.

## Focus and unfocus behavior
- Extension (`src/extension.ts`) monitors window focus and triggers behavior in the webview.
- When focus is lost, it schedules unfocused actions from a backoff list (`lookaround`, `stretch`, `shrug`, `peek`, `walk`, `sit`, `rest`, `laydownflat`, `ballet`).
- After several unfocused steps, it sends `sleep` until focus returns.
- When focus is regained, it restores autopilot, sets `idle`, and sometimes triggers a front move (`forceMove('front')`).

## Webview message handling
- `SET_MOOD`: forces an action (and duration if provided). MCP override keeps control until duration ends or action returns to `idle`.
- `SET_AUTOPILOT`: toggles autopilot AI on/off.
- `FORCE_MOVE`: forces a movement to a peek target and switches to `walk` while moving.

## Props lifecycle
- Each work action has a prop that appears when that action is active.
- Props transition through `hidden` -> `held` -> `dropping` -> `ground` -> `hidden`.
- Sleep particles appear only during `sleep`.

## Behavior when user focuses the window
- Focus regain in `src/extension.ts` sets autopilot on, sends `idle`, and may call `forceMove('front')`.
- In the webview, focus update clears unfocused timers and (now) exits `peek` immediately to prevent getting stuck in front-of-camera peeking.

## Known interactions and constraints
- `blocksAutoLookAt` actions prevent the auto-turn-to-camera behavior in the animation loop.
- `movement` actions skip the unfocused sleep timer while they are active.
- `mcpOverrideActive` bypasses the action post transitions to avoid fights between MCP and autopilot.
