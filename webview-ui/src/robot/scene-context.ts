import type { Clock, MeshBasicMaterial, MeshLambertMaterial, Object3D, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import type { RobotProps } from './actions/props';
import type { ScenePropsManager } from './scene-props';
import type { InteractionState, RobotActionContext, RobotActionName, RobotActionPhase, RobotTargets } from './types';

/**
 * Shared, mutable context for the robot scene.
 *
 * The `RobotScene` class (app/RobotScene.ts) implements this interface and owns
 * every field. The extracted per-frame subsystems (autopilot, interaction,
 * render loop) operate on a `RobotSceneContext` instead of a giant closure, so
 * they can live in their own modules and be reasoned about in isolation.
 */

export type AiState = 'IDLE' | 'MOVING' | 'PERFORMING';

export type CleanupPhase = 'walking' | 'bending' | 'grabbing' | 'rising' | 'celebrate';

export type CleanupState = { phase: CleanupPhase; propName: string; timer: number };

export type MoveBounds = { x: number; zNear: number; zRange: number };

export interface RobotSceneContext {
	// ── Scene graph ─────────────────────────────────────────────────
	scene: Scene;
	camera: PerspectiveCamera;
	renderer: WebGLRenderer;
	matWhite: MeshLambertMaterial;
	matOrange: MeshLambertMaterial;
	matDark: MeshLambertMaterial;
	matMetal: MeshLambertMaterial;
	matEye: MeshBasicMaterial;
	robot: Object3D;
	bodyPivot: Object3D;
	headGroup: Object3D;
	leftEye: Object3D;
	rightEye: Object3D;
	leftArm: Object3D;
	rightArm: Object3D;
	leftLeg: Object3D;
	rightLeg: Object3D;
	antennaBall: Object3D;
	props: RobotProps;
	sceneProps: ScenePropsManager;
	targets: RobotTargets;
	actionContext: RobotActionContext;

	// ── Simulation state ────────────────────────────────────────────
	defaultEyeColorHex: number;
	successEyeColorHex: number;
	errorEyeColorHex: number;
	animationSpeedMultiplier: number;
	movementSpeedMultiplier: number;
	reactToClicks: boolean;
	disabledActions: Set<string>;
	currentTemperature: number;

	currentAction: RobotActionName;
	queuedAction: RobotActionName | undefined;
	actionPhase: RobotActionPhase;
	actionPhaseTimer: number;
	isAutoMode: boolean;
	aiState: AiState;
	aiTimer: number;
	mcpOverrideActive: boolean;
	mcpRequestedAction: RobotActionName | undefined;
	mcpDurationTimer: number;
	mcpTimeoutId: number;
	isUnfocused: boolean;
	unfocusedIdleTimer: number;
	unfocusedSleepDelay: number;
	interaction: InteractionState | null;
	cleanup: CleanupState | null;

	// ── Thrown prop projectile ──────────────────────────────────────
	thrownPropMesh: Object3D | null;
	thrownPropTimer: number;
	thrownPropDuration: number;
	thrownPropStart: Vector3;
	thrownPropEnd: Vector3;
	thrownPropPeak: number;
	thrownPropSpin: number;

	// ── Locomotion ──────────────────────────────────────────────────
	moveTarget: Vector3;
	toCameraDir: Vector3;
	currentSpeed: number;
	tripTimer: number;
	isTripActive: boolean;
	moveBounds: MoveBounds;
	peekTargets: Vector3[];

	// ── Blink / loop ────────────────────────────────────────────────
	clock: Clock;
	animationId: number;
	isBlinking: boolean;
	blinkTimer: number;
	timeSinceLastBlink: number;
	blinkDuration: number;

	// ── Bubble positioning ──────────────────────────────────────────
	bubbleScreenPosRef: { current: { x: number; y: number } };
	bubbleContainerRef: { current: HTMLDivElement | null };

	// ── Tunables ────────────────────────────────────────────────────
	BEND_DURATION: number;
	GRAB_DURATION: number;
	RISE_DURATION: number;
	THROW_DURATION: number;
	TOSS_DURATION: number;
	PUT_DOWN_DURATION: number;
	CLEANUP_ELIGIBLE_SECONDS: number;
	TRIP_DURATION: number;
	TRIP_CHANCE_PER_SECOND: number;

	// ── Behaviors the subsystems call back into ─────────────────────
	setRobotAction(action: RobotActionName, btn?: HTMLElement | null): void;
	getFacingDot(): number;
	isRobotAction(value: string): value is RobotActionName;
	resetTargets(): void;
	resolveActionTransition(delta: number): void;
}
