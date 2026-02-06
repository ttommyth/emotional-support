# Add a New Robot Action

Add a new robot action/animation to the Emotional Support robot. Follow the four-file checklist below exactly — missing any step will cause the action to not appear or cause type errors.

## Required Information

- **Action name**: A short lowercase identifier (e.g. `jumping`, `clapping`)
- **Description**: What the robot should look like while performing this action
- **Tags**: Which of these apply? `work`, `idleLike`, `idleFiller`, `movement`, `sleep`, `restPose`, `blocksAutoLookAt`, `blocksBlink`, `skipPost`
- **Eye color**: One of `cyan`, `red`, `green`, `off`, `purple`, `calm`
- **Has a prop?**: Does this action need a 3D prop object (like the laptop for `coding`)?
- **Needs transitions?**: Should it have entry (`pre`) or exit (`post`) transition animations?

## Checklist (all four files must be updated)

### 1. `src/pet-mood-service.ts` — Add to `PET_ACTIONS` array

Insert the new name string into the `PET_ACTIONS` array. Keep the list logically grouped (work actions together, idle actions together, etc.).

### 2. `webview-ui/src/robot/types.ts` — Add to `RobotActionName` union

Add a new `| '<name>'` line to the `RobotActionName` type. This union must exactly mirror `PET_ACTIONS`.

### 3. `webview-ui/src/robot/actions/<name>.ts` — Create the action file

Export a `RobotActionDefinition`. Use this template:

```ts
import type { RobotActionDefinition } from '../types';

export const <name>: RobotActionDefinition = {
  name: '<name>',
  tags: [/* chosen tags */],
  eyeColor: '<chosen color>',
  apply: (t, { targets }) => {
    // Set target positions and rotations for body parts each frame.
    // t = elapsed time in seconds.
    // Use Math.sin/cos for oscillating animations.
    // targets.head.rot, targets.leftArm.rot, targets.rightArm.rot, etc.
  },
  // Optional: update(delta, time, context) for side effects
  // Optional: pre / post transitions
};
```

**Coordinate reference** (neutral pose):
- Head: pos (0, 3.6, 0), rot (0, 0, 0)
- Arms: pos (±1.6, 1.6, 0), rot (0, 0, ±0.2)
- Legs: rot (0, 0, 0)
- Body: pos (0, 0, 0), rot (0, 0, 0)

### 4. `webview-ui/src/robot/actions/index.ts` — Register the action

Add an import and include in the `robotActions` map object.

## Optional: Add the action to disabled-actions enum

If the action should be disable-able by users, add its name to the `enum` list in the `emotional-support.disabledActions` setting in `package.json`.

## Optional: Add a prop for the action

If this is a `work`-tagged action that should hold an object, see the `add-prop` prompt.

## Testing

1. Run `npm run compile` to verify no type errors
2. Press F5 to launch the Extension Development Host
3. Use the Control Panel or the "Cycle Mood" command to trigger the new action
4. Verify the animation looks correct and transitions work smoothly
