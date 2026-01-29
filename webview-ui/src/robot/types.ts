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
	| 'rest'
	| 'walk'
	| 'wave'
	| 'stretch'
	| 'dance'
	| 'lookaround'
	| 'shrug'
	| 'peek'
	| 'knocked';

export type RobotActionContext = {
	targets: RobotTargets;
	props: RobotProps;
	headGroup: THREE.Object3D;
	robot: THREE.Object3D;
	camera: THREE.Camera;
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

export type RobotActionDefinition = {
	name: RobotActionName;
	apply: (time: number, context: RobotActionContext) => void;
	update?: (delta: number, time: number, context: RobotActionContext) => void;
	pre?: RobotActionTransition;
	post?: RobotActionTransition;
	tags?: RobotActionTag[];
};

export type RobotActionMap = Record<RobotActionName, RobotActionDefinition>;
