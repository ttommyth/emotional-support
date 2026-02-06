# Add a Prop for a Robot Action

Create a 3D prop object that the robot holds during a specific action (like the laptop during `coding` or the clipboard during `reviewing`).

## How Props Work

Props follow a lifecycle managed in `webview-ui/src/robot/actions/props.ts`:

```
hidden → held → dropping → ground → hidden (fade out)
```

- **held**: Prop follows its anchor position (attached to the robot's body)
- **dropping**: Prop is released and falls with simulated gravity
- **ground**: Prop rests on the ground, then fades out

## Steps

### 1. Create the prop factory in the action file

In `webview-ui/src/robot/actions/<action>.ts`, export a `create<Action>Prop` function:

```ts
import * as THREE from 'three';
import type { PropState } from './props';

export function create<Action>Prop(scene: THREE.Scene, bodyPivot: THREE.Object3D): PropState {
  // Create an anchor point attached to the robot body
  const anchor = new THREE.Group();
  anchor.position.set(0, 0.5, 3.2); // Position relative to body pivot
  anchor.rotation.set(0, 0, 0);
  bodyPivot.add(anchor);

  // Build the 3D mesh(es)
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({ color: 0x636e72 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.castShadow = true;
  group.add(mesh);

  scene.add(group);

  return { mesh: group, anchor, state: 'hidden', vel: new THREE.Vector3() };
}
```

**Key rules:**
- The anchor is added as a child of `bodyPivot` so it moves with the robot
- The mesh is added directly to `scene` (it needs to be detachable when dropping)
- Use `MeshLambertMaterial` for props (consistent with the robot's style)
- Set `castShadow = true` on visible meshes
- Use `RoundedBoxGeometry` from `three/examples/jsm/geometries/RoundedBoxGeometry` for rounded shapes

### 2. Register in `webview-ui/src/robot/actions/props.ts`

Import the factory and add it to both the `RobotProps` type and `createRobotProps()`:

```ts
import { create<Action>Prop } from './<action>';

export type RobotProps = {
  // ... existing props ...
  <action>: PropState;
  zParticles: Array<{ mesh: THREE.Sprite; offset: number }>;
};

export function createRobotProps({ scene, bodyPivot }: CreatePropsInput): RobotProps {
  return {
    // ... existing props ...
    <action>: create<Action>Prop(scene, bodyPivot),
    zParticles: createSleepParticles(scene)
  };
}
```

The `updateProps` function automatically manages the lifecycle — if the current action matches the prop key, the prop is shown; otherwise it drops and fades.

### 3. Ensure the action is tagged as `work`

In the action's `RobotActionDefinition`, include `tags: ['work']`. The prop system expects work-tagged actions to have associated props.

## Existing Props (for reference)

| Action | Prop | Description |
|---|---|---|
| `coding` | Laptop | Floating laptop with screen |
| `debugging` | Magnifying glass | Lens with handle |
| `reviewing` | Clipboard | Board with text lines |
| `refactoring` | Wrench | Tool shape |
| `testing` | Flask | Beaker shape |
| `reading` | Book | Open book |
| `thinking` | Thought bubble | Cloud shape |
| `success` | Trophy | Cup shape |

## Guidelines

- Keep prop geometry simple (low poly) — this runs in a sidebar webview
- Position the anchor so the prop appears in the robot's hands during the action
- Match the visual style of existing props (flat colors, rounded shapes, no textures)
- Test the drop animation — the initial velocity is randomized in `updateProps`
