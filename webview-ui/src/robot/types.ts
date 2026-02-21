import type * as THREE from 'three';
import type { RobotProps } from './actions/props';

export type RobotTargets = {
	body: { pos: THREE.Vector3; rot: THREE.Vector3 };
	head: { pos: THREE.Vector3; rot: THREE.Vector3 };
	leftArm: { pos: THREE.Vector3; rot: THREE.Vector3 };
	rightArm: { pos: THREE.Vector3; rot: THREE.Vector3 };
	leftLeg: { rot: THREE.Vector3 };
	rightLeg: { rot: THREE.Vector3 };
};

export type RobotActionName =
	| 'idle'
	| 'thinking'
	| 'coding'
	| 'debugging'
	| 'reviewing'
	| 'refactoring'
	| 'testing'
	| 'reading'
	| 'success'
	| 'error'
	| 'sleep'
	| 'sit'
	| 'laydown'
	| 'laydownflat'
	| 'rest'
	| 'running'
	| 'ballet'
	| 'walk'
	| 'wave'
	| 'stretch'
	| 'dance'
	| 'lookaround'
	| 'shrug'
	| 'peek'
	| 'knocked'
	| 'tidyup'
	| 'stroll'
	| 'tripped';

export type RobotActionContext = {
	targets: RobotTargets;
	props: RobotProps;
	headGroup: THREE.Object3D;
	robot: THREE.Object3D;
	camera: THREE.Camera;
	/** Animation temperature 0–1. 0 = very calm/slow, 0.5 = normal, 1 = hyper/energetic */
	temperature: number;
};

export type RobotActionTag =
	| 'idleLike'
	| 'idleFiller'
	| 'work'
	| 'sleep'
	| 'movement'
	| 'restPose'
	| 'blocksAutoLookAt'
	| 'blocksBlink'
	| 'skipPost';

export type RobotActionPhase = 'pre' | 'main' | 'post';

export type RobotActionTransition = {
	duration: number;
	apply: (progress: number, time: number, context: RobotActionContext) => void;
};

export type RobotEyeColorName = 'cyan' | 'red' | 'green' | 'off' | 'purple' | 'calm';

export type RobotActionDefinition = {
	name: RobotActionName;
	apply: (time: number, context: RobotActionContext) => void;
	update?: (delta: number, time: number, context: RobotActionContext) => void;
	pre?: RobotActionTransition;
	post?: RobotActionTransition;
	tags?: RobotActionTag[];
	eyeColor?: RobotEyeColorName;
};

export type RobotActionMap = Record<RobotActionName, RobotActionDefinition>;

// ─── Scene prop types ─────────────────────────────────────────────────────

export type ScenePropType =
	| 'paper'
	| 'laptop'
	| 'magnifying_glass'
	| 'clipboard'
	| 'wrench'
	| 'test_tubes'
	| 'lightbulb'
	| 'book'
	| 'coffee_mug'
	| 'star'
	| 'trophy';

/**
 * Maps each scene prop type to the robot action it triggers upon pickup.
 * `null` means decoration-only (no pickup interaction possible).
 */
export const SCENE_PROP_ACTION_MAP: Record<ScenePropType, RobotActionName | null> = {
	paper: 'reading',
	laptop: 'coding',
	magnifying_glass: 'debugging',
	clipboard: 'reviewing',
	wrench: 'refactoring',
	test_tubes: 'testing',
	lightbulb: 'thinking',
	book: 'reading',
	coffee_mug: null,
	star: null,
	trophy: null
};

export type ScenePropState = 'spawning' | 'idle' | 'targeted' | 'grabbed' | 'despawning';

export type ScenePropPlacement = {
	id: string;
	type: ScenePropType;
	label?: string;
	mesh: THREE.Object3D;
	state: ScenePropState;
	worldX: number;
	worldZ: number;
	// remember the rotation we initially gave the prop so idle animation can
	// oscillate around it without resetting back to zero.
	initialRotZ: number;
	spawnProgress: number;
	despawnProgress: number;
	idleTimer: number;            // seconds spent idle (used for automatic cleanup)
	autoInteract: boolean;
};

/** Named ground positions mapping to world coordinates.
 * Camera is at z=18; robot is around z=0-5.
 * Lower z = further from camera (deeper into scene). */
export const SCENE_POSITION_COORDS: Record<string, { x: number; z: number }> = {
	'far-left': { x: -14, z: -4 },
	left: { x: -9, z: -2 },
	'center-left': { x: -5, z: -3 },
	center: { x: 0, z: -3.5 },
	'center-right': { x: 5, z: -3 },
	right: { x: 9, z: -2 },
	'far-right': { x: 14, z: -4 },
	'back-left': { x: -7, z: -7 },
	back: { x: 0, z: -8 },
	'back-right': { x: 7, z: -7 },
	front: { x: 0, z: 1 },
	'front-left': { x: -6, z: 0.5 },
	'front-right': { x: 6, z: 0.5 }
};

export const GROUND_Y = -4.3;

// ─── Interaction types ────────────────────────────────────────────────────

export type InteractionPhase = 'none' | 'walking' | 'bending' | 'grabbing' | 'rising' | 'performing' | 'throwing' | 'tossing' | 'putting_down';

export type FinishBehavior = 'throw_away' | 'throw_up' | 'put_down' | 'none';

export type InteractionState = {
	phase: InteractionPhase;
	propId: string;
	propType: ScenePropType;
	targetAction: RobotActionName;
	timer: number;
	durationAfterPickup: number;
	finishBehavior: FinishBehavior;
};
