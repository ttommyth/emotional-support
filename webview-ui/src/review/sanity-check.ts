/**
 * Headless sanity-check for robot actions, action props and scene props.
 *
 * DOM-free on purpose: it runs in Node (bundled by `scripts/verify-actions.mjs`)
 * AND in the browser (dev review page "Run Check" button) against the same rig.
 *
 * What it exercises:
 *  - every action's `apply()` across a time sweep on the real robot rig,
 *  - each action's `update()` and `pre`/`post` transitions,
 *  - every action prop `buildMesh()` (anchor validity + mesh bounds),
 *  - every scene prop type's `buildScenePropMesh()`.
 *
 * It flags NaN/Infinity, absurd magnitudes, dead (no-movement) actions and
 * broken/unbounded prop meshes, and records the extreme values so a human can
 * judge whether the ranges "look normal".
 */

import * as THREE from 'three';
import { robotActions, actionPropDefs } from '../robot/actions';
import { ACTION_ORDER } from '../robot/action-labels';
import { createRobotMesh } from '../scene/createRobotMesh';
import { buildScenePropMesh } from '../robot/scene-props';
import { SCENE_PROP_ACTION_MAP } from '../robot/types';
import type { RobotActionContext, RobotActionName, RobotTargets, ScenePropType } from '../robot/types';
import type { PropDefinition } from '../robot/actions/helpers';
import type { RobotProps } from '../robot/actions/props';

// ─── Tunables ─────────────────────────────────────────────────────────────

/** Sweep each action for this many seconds to hit every phase. */
const SWEEP_END = 12;
/** Step between samples. */
const SWEEP_STEP = 0.05;
/** Flag any target magnitude beyond this (positions ~4 max, ballet yaw reaches 2π). */
const MAX_ABS_BOUND = 6.5;
/** An action whose targets never deviate this far from reset is "dead". */
const DEAD_AMPLITUDE = 0.01;

// ─── Report types ─────────────────────────────────────────────────────────

export type ExtremeEntry = { key: string; min: number; max: number };

export type ActionCheck = {
	name: RobotActionName;
	defined: boolean;
	hasPre: boolean;
	hasPost: boolean;
	hasUpdate: boolean;
	tags: string[];
	eyeColor: string | null;
	hasProp: boolean;
	applyError: string | null;
	updateError: string | null;
	preError: string | null;
	postError: string | null;
	samples: number;
	nanCount: number;
	maxAbs: number;
	amplitude: number;
	exceedsBounds: boolean;
	dead: boolean;
	extremes: ExtremeEntry[];
	/** Minimum distance (units) between each hand and the prop anchor over the sweep.
	 *  null when the action has no prop. Small = the hand actually reaches the prop. */
	handGaps: { left: number; right: number } | null;
};

export type PropCheck = {
	name: string;
	buildError: string | null;
	nodeCount: number;
	meshCount: number;
	size: number;
	nanCount: number;
	anchorPos: [number, number, number];
	anchorRot: [number, number, number];
	box: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number } | null;
};

export type ScenePropCheck = {
	type: ScenePropType;
	buildError: string | null;
	nodeCount: number;
	meshCount: number;
	size: number;
	nanCount: number;
};

export type SanityReport = {
	actionCount: number;
	propCount: number;
	scenePropCount: number;
	missingFromMap: string[];
	extraInMap: string[];
	actions: ActionCheck[];
	props: PropCheck[];
	sceneProps: ScenePropCheck[];
};

// ─── Internal helpers ─────────────────────────────────────────────────────

function targetParts(targets: RobotTargets): Array<[string, THREE.Vector3]> {
	return [
		['body.pos', targets.body.pos],
		['body.rot', targets.body.rot],
		['head.pos', targets.head.pos],
		['head.rot', targets.head.rot],
		['leftArm.pos', targets.leftArm.pos],
		['leftArm.rot', targets.leftArm.rot],
		['rightArm.pos', targets.rightArm.pos],
		['rightArm.rot', targets.rightArm.rot],
		['leftLeg.rot', targets.leftLeg.rot],
		['rightLeg.rot', targets.rightLeg.rot]
	];
}

function resetTargets(targets: RobotTargets): void {
	targets.body.pos.set(0, 0, 0);
	targets.body.rot.set(0, 0, 0);
	targets.head.pos.set(0, 3.5, 0);
	targets.head.rot.set(0, 0, 0);
	targets.leftArm.pos.set(-2.2, 1.5, 0);
	targets.leftArm.rot.set(0, 0, 0);
	targets.rightArm.pos.set(2.2, 1.5, 0);
	targets.rightArm.rot.set(0, 0, 0);
	targets.leftLeg.rot.set(0, 0, 0);
	targets.rightLeg.rot.set(0, 0, 0);
}

type SweepStats = {
	applyError: string | null;
	samples: number;
	nanCount: number;
	maxAbs: number;
	amplitude: number;
	extremes: ExtremeEntry[];
};

function sweepAction(name: RobotActionName, ctx: RobotActionContext): SweepStats {
	const targets = ctx.targets;
	const parts = targetParts(targets);
	const track: Record<string, { min: number; max: number }> = {};
	const resetVals: Record<string, number> = {};
	let nanCount = 0;
	let maxAbs = 0;
	let amplitude = 0;
	let samples = 0;
	let applyError: string | null = null;

	resetTargets(targets);
	for (const [key, vec] of parts) {
		for (let a = 0; a < 3; a++) {
			resetVals[`${key}.${'xyz'[a]}`] = vec.getComponent(a);
		}
	}

	const sample = (): void => {
		for (const [key, vec] of parts) {
			for (let a = 0; a < 3; a++) {
				const axis = 'xyz'[a];
				const v = vec.getComponent(a);
				const k = `${key}.${axis}`;
				if (!Number.isFinite(v)) {
					nanCount++;
					continue;
				}
				const abs = Math.abs(v);
				if (abs > maxAbs) maxAbs = abs;
				const cur = track[k];
				if (cur) {
					if (v < cur.min) cur.min = v;
					if (v > cur.max) cur.max = v;
				} else {
					track[k] = { min: v, max: v };
				}
				const dev = Math.abs(v - (resetVals[k] ?? 0));
				if (dev > amplitude) amplitude = dev;
			}
		}
	};

	for (let t = 0; t <= SWEEP_END; t += SWEEP_STEP) {
		resetTargets(targets);
		try {
			robotActions[name].apply(t, ctx);
		} catch (error) {
			applyError = error instanceof Error ? error.message : String(error);
			break;
		}
		sample();
		samples++;
	}

	const extremes: ExtremeEntry[] = Object.entries(track).map(([key, v]) => ({ key, min: v.min, max: v.max }));
	return { applyError, samples, nanCount, maxAbs, amplitude, extremes };
}

type TransitionCheck = { has: boolean; error: string | null };

function checkTransition(name: RobotActionName, phase: 'pre' | 'post', ctx: RobotActionContext): TransitionCheck {
	const def = robotActions[name];
	const tr = phase === 'pre' ? def.pre : def.post;
	if (!tr) {
		return { has: false, error: null };
	}
	let error: string | null = null;
	try {
		for (let p = 0; p <= 1; p += 0.1) {
			resetTargets(ctx.targets);
			tr.apply(p, 1, ctx);
		}
	} catch (e) {
		error = e instanceof Error ? e.message : String(e);
	}
	return { has: true, error };
}

function checkUpdate(name: RobotActionName, ctx: RobotActionContext): { has: boolean; error: string | null } {
	const def = robotActions[name];
	if (!def.update) {
		return { has: false, error: null };
	}
	let error: string | null = null;
	try {
		for (let t = 0; t <= 4; t += 0.2) {
			resetTargets(ctx.targets);
			def.update(0.016, t, ctx);
		}
	} catch (e) {
		error = e instanceof Error ? e.message : String(e);
	}
	return { has: true, error };
}

/**
 * Measures how far each hand lands from the action's prop anchor (in
 * bodyPivot-local units) over a short sweep. A small gap (< 0.5) means the
 * arm animation actually brings the hand to the prop; a large gap means the
 * prop floats disconnected from the hand (a common "this prop looks weird"
 * symptom). Returns null for actions without a prop.
 */
function computeHandGaps(name: RobotActionName, ctx: RobotActionContext): { left: number; right: number } | null {
	const propDef = actionPropDefs.get(name);
	if (!propDef) return null;
	const attached = propDef.attachToArm ?? null;
	const anchorLocal = new THREE.Vector3(propDef.anchor.position[0], propDef.anchor.position[1], propDef.anchor.position[2]);
	const offset = new THREE.Vector3(0, -2.2, 0); // hand is 2.2 below the shoulder pivot
	const euler = new THREE.Euler();
	const hand = new THREE.Vector3();
	const anchor = new THREE.Vector3();
	let bestLeft = Infinity;
	let bestRight = Infinity;
	for (let t = 0; t <= 6; t += 0.1) {
		resetTargets(ctx.targets);
		robotActions[name].apply(t, ctx);
		const arms: Array<{ side: 'left' | 'right'; pos: THREE.Vector3; rot: THREE.Vector3 }> = [
			{ side: 'left', pos: ctx.targets.leftArm.pos, rot: ctx.targets.leftArm.rot },
			{ side: 'right', pos: ctx.targets.rightArm.pos, rot: ctx.targets.rightArm.rot }
		];
		for (const arm of arms) {
			euler.set(arm.rot.x, arm.rot.y, arm.rot.z);
			hand.copy(offset).applyEuler(euler).add(arm.pos);
			// Anchor in bodyPivot space: hand-attached → arm.pos + R(armRot) * anchorLocal
			if (attached === arm.side) {
				anchor.copy(anchorLocal).applyEuler(euler).add(arm.pos);
			} else {
				anchor.copy(anchorLocal);
			}
			const d = hand.distanceTo(anchor);
			if (arm.side === 'left') {
				if (d < bestLeft) bestLeft = d;
			} else if (d < bestRight) {
				bestRight = d;
			}
		}
	}
	return { left: bestLeft, right: bestRight };
}

function countNodes(obj: THREE.Object3D): number {
	let n = 1;
	for (const child of obj.children) n += countNodes(child);
	return n;
}

function countMeshes(obj: THREE.Object3D): number {
	let n = obj instanceof THREE.Mesh ? 1 : 0;
	for (const child of obj.children) n += countMeshes(child);
	return n;
}

function checkProp(name: string, def: PropDefinition): PropCheck {
	const anchorPos: [number, number, number] = [def.anchor.position[0], def.anchor.position[1], def.anchor.position[2]];
	const anchorRot: [number, number, number] = [def.anchor.rotation[0], def.anchor.rotation[1], def.anchor.rotation[2]];
	let buildError: string | null = null;
	let nodeCount = 0;
	let meshCount = 0;
	let size = 0;
	let nanCount = 0;
	let box: PropCheck['box'] = null;
	for (const v of [...anchorPos, ...anchorRot]) {
		if (!Number.isFinite(v)) nanCount++;
	}
	try {
		const mesh = def.buildMesh();
		nodeCount = countNodes(mesh);
		meshCount = countMeshes(mesh);
		const b = new THREE.Box3().setFromObject(mesh);
		const min = b.min;
		const max = b.max;
		for (const v of [min.x, min.y, min.z, max.x, max.y, max.z]) {
			if (!Number.isFinite(v)) nanCount++;
		}
		box = { minX: min.x, minY: min.y, minZ: min.z, maxX: max.x, maxY: max.y, maxZ: max.z };
		size = Math.hypot(max.x - min.x, max.y - min.y, max.z - min.z);
	} catch (error) {
		buildError = error instanceof Error ? error.message : String(error);
	}
	return { name, buildError, nodeCount, meshCount, size, nanCount, anchorPos, anchorRot, box };
}

function checkSceneProp(type: ScenePropType): ScenePropCheck {
	let buildError: string | null = null;
	let nodeCount = 0;
	let meshCount = 0;
	let size = 0;
	let nanCount = 0;
	try {
		const mesh = buildScenePropMesh(type);
		nodeCount = countNodes(mesh);
		meshCount = countMeshes(mesh);
		const b = new THREE.Box3().setFromObject(mesh);
		const min = b.min;
		const max = b.max;
		for (const v of [min.x, min.y, min.z, max.x, max.y, max.z]) {
			if (!Number.isFinite(v)) nanCount++;
		}
		size = Math.hypot(max.x - min.x, max.y - min.y, max.z - min.z);
	} catch (error) {
		buildError = error instanceof Error ? error.message : String(error);
	}
	return { type, buildError, nodeCount, meshCount, size, nanCount };
}

// ─── Entry point ──────────────────────────────────────────────────────────

export function runSanityCheck(): SanityReport {
	// Real rig, no renderer needed.
	const scene = new THREE.Scene();
	const matWhite = new THREE.MeshLambertMaterial({ color: 0xffffff });
	const matOrange = new THREE.MeshLambertMaterial({ color: 0xff9f43 });
	const matDark = new THREE.MeshLambertMaterial({ color: 0x343a40 });
	const matMetal = new THREE.MeshLambertMaterial({ color: 0xaabbaa });
	const matEye = new THREE.MeshBasicMaterial({ color: 0x00d2d3 });
	const robotMesh = createRobotMesh(scene, { matWhite, matOrange, matDark, matMetal, matEye });
	const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
	camera.position.set(0, 3.6, 18);

	const targets: RobotTargets = {
		body: { pos: new THREE.Vector3(), rot: new THREE.Vector3() },
		head: { pos: new THREE.Vector3(0, 3.5, 0), rot: new THREE.Vector3() },
		leftArm: { pos: new THREE.Vector3(-2.2, 1.5, 0), rot: new THREE.Vector3() },
		rightArm: { pos: new THREE.Vector3(2.2, 1.5, 0), rot: new THREE.Vector3() },
		leftLeg: { rot: new THREE.Vector3() },
		rightLeg: { rot: new THREE.Vector3() }
	};

	const mockProps: RobotProps = {
		items: new Map(),
		zParticles: [],
		get: () => undefined,
		getGroundProps: () => []
	};

	const ctx: RobotActionContext = {
		targets,
		props: mockProps,
		headGroup: robotMesh.headGroup,
		robot: robotMesh.robot,
		camera,
		temperature: 0.5
	};

	const definedNames = ACTION_ORDER.filter((n) => n in robotActions) as RobotActionName[];
	const extraInMap = (Object.keys(robotActions) as RobotActionName[]).filter((n) => !ACTION_ORDER.includes(n));
	const missingFromMap = ACTION_ORDER.filter((n) => !(n in robotActions));
	const names = [...definedNames, ...extraInMap];

	const actions: ActionCheck[] = names.map((name) => {
		const def = robotActions[name];
		const sweep = sweepAction(name, ctx);
		const pre = checkTransition(name, 'pre', ctx);
		const post = checkTransition(name, 'post', ctx);
		const update = checkUpdate(name, ctx);
		return {
			name,
			defined: true,
			hasPre: pre.has,
			hasPost: post.has,
			hasUpdate: update.has,
			tags: def.tags ?? [],
			eyeColor: def.eyeColor ?? null,
			hasProp: actionPropDefs.has(name),
			applyError: sweep.applyError,
			updateError: update.error,
			preError: pre.error,
			postError: post.error,
			samples: sweep.samples,
			nanCount: sweep.nanCount,
			maxAbs: sweep.maxAbs,
			amplitude: sweep.amplitude,
			exceedsBounds: sweep.maxAbs > MAX_ABS_BOUND,
			dead: sweep.amplitude < DEAD_AMPLITUDE,
			extremes: sweep.extremes,
			handGaps: computeHandGaps(name, ctx)
		};
	});

	const props: PropCheck[] = Array.from(actionPropDefs.entries()).map(([name, def]) => checkProp(name, def));
	const scenePropTypes = Object.keys(SCENE_PROP_ACTION_MAP) as ScenePropType[];
	const sceneProps: ScenePropCheck[] = scenePropTypes.map((type) => checkSceneProp(type));

	return { actionCount: actions.length, propCount: props.length, scenePropCount: sceneProps.length, missingFromMap, extraInMap, actions, props, sceneProps };
}
