/**
 * Action & Prop helpers — utilities for building robot actions and props.
 *
 * These helpers provide a standardized way to define actions and props so that
 * AI agents (or humans) can extend the robot's behavior by following a simple,
 * consistent pattern.
 */

import * as THREE from 'three';
import type {
	RobotActionDefinition,
	RobotActionName,
	RobotActionTag,
	RobotActionTransition,
	RobotEyeColorName,
	RobotActionContext
} from '../types';

// ─── Prop helpers ───────────────────────────────────────────────────────────

export type PropState = {
	mesh: THREE.Object3D;
	anchor: THREE.Object3D;
	state: 'hidden' | 'held' | 'dropping' | 'ground';
	vel: THREE.Vector3;
	/** Seconds the prop has been sitting on the ground */
	groundTimer: number;
};

/**
 * Declarative anchor point configuration.
 * Position and rotation are relative to the bodyPivot.
 */
export type AnchorConfig = {
	position: [x: number, y: number, z: number];
	rotation: [x: number, y: number, z: number];
};

/**
 * Common anchor presets for frequent prop placements.
 * Use these as starting points and adjust as needed.
 */
export const ANCHOR_PRESETS = {
	/** In front of body, held with both hands (laptop, clipboard) */
	frontHeld: { position: [0, 0.6, 3.2], rotation: [0.15, Math.PI, 0] } as AnchorConfig,
	/** Left hand — held in the left hand */
	leftHand: { position: [-2.3, 1.3, 2.4], rotation: [0.2, Math.PI, 0.2] } as AnchorConfig,
	/** Right hand — held in the right hand */
	rightHand: { position: [2.3, 1.3, 2.4], rotation: [0.2, Math.PI, -0.2] } as AnchorConfig,
	/** Above head — floating above (lightbulb, star) */
	aboveHead: { position: [0, 6.8, 1.1], rotation: [0, Math.PI, 0] } as AnchorConfig,
	/** Head level right — near right side of head */
	headRight: { position: [2, 6, 1.2], rotation: [0, Math.PI, 0] } as AnchorConfig
} as const;

export type PropDefinition = {
	/** Anchor point config (use ANCHOR_PRESETS or custom) */
	anchor: AnchorConfig;
	/**
	 * Optionally parent the prop to the robot's hand so it moves with the arm
	 * instead of floating at a fixed body point. When set, `anchor` is
	 * interpreted relative to that arm group (the hand sits at (0,-2.2,0)).
	 */
	attachToArm?: 'left' | 'right';
	/** Build the 3D mesh for this prop. Return the root Object3D. */
	buildMesh: () => THREE.Object3D;
	/**
	 * Optional per-frame update while the prop is held.
	 * Use this for wobble, rotation, glow effects etc.
	 */
	heldUpdate?: (mesh: THREE.Object3D, time: number, delta: number) => void;
};

/**
 * Creates a PropState from a declarative PropDefinition.
 * Handles anchor creation, scene attachment, and initial hidden state.
 */
export function createPropFromDefinition(
	def: PropDefinition,
	scene: THREE.Scene,
	bodyPivot: THREE.Object3D,
	arms?: { left: THREE.Object3D; right: THREE.Object3D }
): PropState {
	const anchor = new THREE.Group();
	anchor.position.set(...def.anchor.position);
	anchor.rotation.set(...def.anchor.rotation);
	// Hand-attached props ride along with the arm group so they follow the hand.
	const parent = def.attachToArm && arms ? arms[def.attachToArm] : bodyPivot;
	parent.add(anchor);

	const mesh = def.buildMesh();
	scene.add(mesh);

	return { mesh, anchor, state: 'hidden', vel: new THREE.Vector3(), groundTimer: 0 };
}

// ─── Action helpers ─────────────────────────────────────────────────────────

/**
 * Temperature utility — maps the 0–1 temperature into a usable multiplier.
 *
 * - `temp(ctx)` → amplitude multiplier (0.3 at temp=0, 1.0 at temp=0.5, 2.0 at temp=1)
 * - `tempSpeed(ctx)` → time-speed multiplier (0.5 at temp=0, 1.0 at temp=0.5, 1.8 at temp=1)
 * - `tempLerp(ctx, lo, hi)` → lerp between lo/hi based on temperature
 *
 * Actions use these to scale amplitudes and frequencies based on the workspace vibe
 * or explicit MCP temperature setting. Default temperature is 0.5 (1.0× multiplier).
 */

/** Amplitude multiplier: 0.3× at temp=0 → 1.0× at temp=0.5 → 2.0× at temp=1 */
export function temp(ctx: { temperature: number }): number {
	const t = ctx.temperature;
	if (t <= 0.5) {
		// 0→0.5 maps to 0.3→1.0
		return 0.3 + (t / 0.5) * 0.7;
	}
	// 0.5→1.0 maps to 1.0→2.0
	return 1.0 + ((t - 0.5) / 0.5) * 1.0;
}

/** Speed multiplier: 0.5× at temp=0 → 1.0× at temp=0.5 → 1.8× at temp=1 */
export function tempSpeed(ctx: { temperature: number }): number {
	const t = ctx.temperature;
	if (t <= 0.5) {
		return 0.5 + (t / 0.5) * 0.5;
	}
	return 1.0 + ((t - 0.5) / 0.5) * 0.8;
}

/** Linear interpolation between lo and hi based on temperature (0→lo, 1→hi) */
export function tempLerp(ctx: { temperature: number }, lo: number, hi: number): number {
	return lo + ctx.temperature * (hi - lo);
}

/**
 * Full action configuration — the single object an AI needs to provide
 * to define a new robot action.
 */
export type ActionConfig = {
	name: RobotActionName;
	/** Per-frame target-setting function (required) */
	apply: (time: number, context: RobotActionContext) => void;
	/** Per-frame side-effects (prop wobble, particles, etc.) */
	update?: (delta: number, time: number, context: RobotActionContext) => void;
	/** Entry transition */
	pre?: RobotActionTransition;
	/** Exit transition */
	post?: RobotActionTransition;
	/** Categorization tags */
	tags?: RobotActionTag[];
	/** Eye color while this action is active */
	eyeColor?: RobotEyeColorName;
	/** Optional prop definition — will be auto-registered */
	prop?: PropDefinition;
};

/**
 * Converts an ActionConfig into a RobotActionDefinition.
 * If the action has a prop with a heldUpdate, it is automatically
 * wired into the update function.
 */
export function defineAction(config: ActionConfig): RobotActionDefinition & { prop?: PropDefinition } {
	const { prop, update, ...rest } = config;

	let mergedUpdate = update;
	if (prop?.heldUpdate) {
		const originalUpdate = update;
		const propUpdate = prop.heldUpdate;
		mergedUpdate = (delta, time, context) => {
			originalUpdate?.(delta, time, context);
			const propState = context.props.get(config.name);
			if (propState?.state === 'held') {
				propUpdate(propState.mesh, time, delta);
			}
		};
	}

	return {
		...rest,
		update: mergedUpdate,
		prop
	};
}

// ─── Transition helpers ─────────────────────────────────────────────────────

/** Smooth-step easing: accelerate then decelerate */
export function smoothStep(p: number): number {
	return p * p * (3 - 2 * p);
}

/** Quintic smooth-step: smoother ease-in-out */
export function smootherStep(p: number): number {
	return p * p * p * (p * (6 * p - 15) + 10);
}

/**
 * Helper to create a simple pose-based pre/post transition pair.
 * Provide the target pose values at full engagement, and this generates
 * both pre (ease-in) and post (ease-out) transitions.
 *
 * @param pose - Function that applies the pose at a given eased intensity (0-1)
 * @param preDuration - Duration of the entry transition
 * @param postDuration - Duration of the exit transition
 */
export function createPoseTransitions(
	pose: (eased: number, time: number, context: RobotActionContext) => void,
	preDuration: number,
	postDuration: number
): { pre: RobotActionTransition; post: RobotActionTransition } {
	return {
		pre: {
			duration: preDuration,
			apply: (p, t, ctx) => pose(smoothStep(p), t, ctx)
		},
		post: {
			duration: postDuration,
			apply: (p, t, ctx) => pose(1 - smootherStep(p), t, ctx)
		}
	};
}
