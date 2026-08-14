import { Clock, MathUtils, Object3D, Vector3 } from 'three';
import type { MeshBasicMaterial, MeshLambertMaterial, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { robotActions, actionPropDefs } from '../robot/actions';
import { getEyeColor } from '../robot/actions/eyes';
import { createRobotProps } from '../robot/actions/props';
import { createScenePropsManager } from '../robot/scene-props';
import type { FinishBehavior, InteractionState, RobotActionContext, RobotActionName, RobotActionPhase, RobotTargets, ScenePropType } from '../robot/types';
import { SCENE_POSITION_COORDS } from '../robot/types';
import type { AiState, CleanupState, MoveBounds, RobotSceneContext } from '../robot/scene-context';
import type { RobotColors } from '../scene/setupScene';
import { setupScene } from '../scene/setupScene';
import { createRobotMesh } from '../scene/createRobotMesh';
import { handleMessage, type InteractWithPropMessage, type PlaceScenePropMessage, type RobotSceneController, type SetConfigMessage, type SetMoodMessage, type SetSceneMessage } from '../messaging/message-handler';
import { startInteraction } from '../robot/interaction';
import { startRenderLoop } from '../render/render-loop';
import { normalizeRotation } from '../render/lerp';

export type RobotSceneOptions = {
	containerEl: HTMLElement;
	vscode: { postMessage: (message: unknown) => void };
	addToast: (text: string) => void;
	bubbleScreenPosRef: { current: { x: number; y: number } };
	bubbleContainerRef: { current: HTMLDivElement | null };
	showThoughtBubblesRef: { current: boolean };
	thoughtBubbleDurationRef: { current: number };
};

/**
 * The robot scene.
 *
 * Owns the whole scene graph, all mutable simulation state, and the
 * message/click/focus/resize handlers. Implements `RobotSceneContext` so the
 * per-frame subsystems (autopilot, interaction, render loop) operate on it
 * from their own modules instead of a giant closure, and implements
 * `RobotSceneController` so webview messages route straight into `this`.
 */
export class RobotScene implements RobotSceneContext, RobotSceneController {
	// ── Injected options ────────────────────────────────────────────
	private readonly containerEl: HTMLElement;
	private readonly vscode: { postMessage: (message: unknown) => void };
	private readonly addToast: (text: string) => void;
	private readonly showThoughtBubblesRef: { current: boolean };
	private readonly thoughtBubbleDurationRef: { current: number };
	private readonly colors: RobotColors;

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
	props: import('../robot/actions/props').RobotProps;
	sceneProps: import('../robot/scene-props').ScenePropsManager;
	targets: RobotTargets;
	actionContext: RobotActionContext;

	// ── Simulation state ─────────────────────────────────────────────
	defaultEyeColorHex: number;
	successEyeColorHex: number;
	errorEyeColorHex: number;
	animationSpeedMultiplier = 1.0;
	movementSpeedMultiplier = 1.0;
	reactToClicks = true;
	disabledActions: Set<string> = new Set();
	/** Animation temperature 0–1. 0 = calm, 0.5 = normal, 1 = hyper */
	currentTemperature = 0.5;

	currentAction: RobotActionName = 'idle';
	queuedAction: RobotActionName | undefined;
	actionPhase: RobotActionPhase = 'main';
	actionPhaseTimer = 0;
	isAutoMode = true;
	aiState: AiState = 'IDLE';
	aiTimer = 0;
	mcpOverrideActive = false;
	mcpRequestedAction: RobotActionName | undefined;
	mcpDurationTimer = 0;
	mcpTimeoutId = 0;
	isUnfocused = document.hidden || !document.hasFocus();
	unfocusedIdleTimer = 0;
	unfocusedSleepDelay = 20;
	interaction: InteractionState | null = null;
	cleanup: CleanupState | null = null;

	// ── Thrown prop projectile ───────────────────────────────────────
	thrownPropMesh: Object3D | null = null;
	thrownPropTimer = 0;
	thrownPropDuration = 0;
	thrownPropStart = new Vector3();
	thrownPropEnd = new Vector3();
	thrownPropPeak = 0; // Y height at apex
	thrownPropSpin = 0;

	// ── Locomotion ───────────────────────────────────────────────────
	moveTarget = new Vector3();
	toCameraDir = new Vector3();
	private forwardDir = new Vector3(0, 0, 1);
	private yAxis = new Vector3(0, 1, 0);
	currentSpeed = 0;
	/** Timer for the trip animation — counts up while tripped */
	tripTimer = 0;
	isTripActive = false;
	moveBounds: MoveBounds = { x: 10, zNear: 2, zRange: 6 };
	peekTargets: Vector3[] = [
		new Vector3(-7, -0.4, 8.5),
		new Vector3(7, -0.4, 8.5),
		new Vector3(0, -1.2, 9.2)
	];

	// ── Blink / loop ─────────────────────────────────────────────────
	clock = new Clock();
	animationId = 0;
	isBlinking = false;
	blinkTimer = 0;
	timeSinceLastBlink = 0;
	blinkDuration = 0.15;

	// ── Bubble positioning ───────────────────────────────────────────
	bubbleScreenPosRef: { current: { x: number; y: number } };
	bubbleContainerRef: { current: HTMLDivElement | null };

	// ── Tunables ─────────────────────────────────────────────────────
	BEND_DURATION = 0.5;
	GRAB_DURATION = 0.3;
	RISE_DURATION = 0.4;
	THROW_DURATION = 0.6;
	TOSS_DURATION = 0.5;
	PUT_DOWN_DURATION = 0.6;
	/** Seconds a ground prop must sit before the robot considers cleaning it */
	CLEANUP_ELIGIBLE_SECONDS = 8;
	/** Duration of the trip animation — must match tripped.ts export */
	TRIP_DURATION = 2.6;
	/** Base probability per second that the robot will trip while running */
	TRIP_CHANCE_PER_SECOND = 0.04;

	// ── Click interaction timers ─────────────────────────────────────
	private clickTimeoutId: number | undefined;
	private clickIntervalId: number | undefined;
	private lastClickTime = 0;
	private clickTargetRotation = 0;
	private clickTurnSpeed = 0.08;

	private resizeRaf = 0;
	private resizeObserver: ResizeObserver | undefined;

	constructor(opts: RobotSceneOptions) {
		this.containerEl = opts.containerEl;
		this.vscode = opts.vscode;
		this.addToast = opts.addToast;
		this.showThoughtBubblesRef = opts.showThoughtBubblesRef;
		this.thoughtBubbleDurationRef = opts.thoughtBubbleDurationRef;
		this.bubbleScreenPosRef = opts.bubbleScreenPosRef;
		this.bubbleContainerRef = opts.bubbleContainerRef;

		const setup = setupScene(opts.containerEl);
		this.scene = setup.scene;
		this.camera = setup.camera;
		this.renderer = setup.renderer;
		this.colors = setup.colors;
		this.matWhite = setup.matWhite;
		this.matOrange = setup.matOrange;
		this.matDark = setup.matDark;
		this.matMetal = setup.matMetal;
		this.matEye = setup.matEye;

		this.defaultEyeColorHex = setup.colors.eyeCyan;
		this.successEyeColorHex = setup.colors.eyeGreen;
		this.errorEyeColorHex = setup.colors.eyeRed;

		const robotMesh = createRobotMesh(this.scene, { matWhite: this.matWhite, matOrange: this.matOrange, matDark: this.matDark, matMetal: this.matMetal, matEye: this.matEye });
		this.robot = robotMesh.robot;
		this.bodyPivot = robotMesh.bodyPivot;
		this.headGroup = robotMesh.headGroup;
		this.leftEye = robotMesh.leftEye;
		this.rightEye = robotMesh.rightEye;
		this.leftArm = robotMesh.leftArm;
		this.rightArm = robotMesh.rightArm;
		this.leftLeg = robotMesh.leftLeg;
		this.rightLeg = robotMesh.rightLeg;
		this.antennaBall = robotMesh.antennaBall;

		this.props = createRobotProps({ scene: this.scene, bodyPivot: this.bodyPivot }, actionPropDefs);

		this.targets = {
			body: { pos: new Vector3(), rot: new Vector3() },
			head: { pos: new Vector3(0, 3.5, 0), rot: new Vector3() },
			leftArm: { pos: new Vector3(-2.2, 1.5, 0), rot: new Vector3() },
			rightArm: { pos: new Vector3(2.2, 1.5, 0), rot: new Vector3() },
			leftLeg: { rot: new Vector3() },
			rightLeg: { rot: new Vector3() }
		};

		this.actionContext = {
			targets: this.targets,
			props: this.props,
			headGroup: this.headGroup,
			robot: this.robot,
			camera: this.camera,
			temperature: 0.5
		};

		this.sceneProps = createScenePropsManager(this.scene);
	}

	// ── Context behaviors called by the extracted subsystems ────────

	resetTargets() {
		this.targets.body.pos.set(0, 0, 0);
		this.targets.body.rot.set(0, 0, 0);
		this.targets.head.pos.set(0, 3.5, 0);
		this.targets.head.rot.set(0, 0, 0);
		this.targets.leftArm.pos.set(-2.2, 1.5, 0);
		this.targets.leftArm.rot.set(0, 0, 0);
		this.targets.rightArm.pos.set(2.2, 1.5, 0);
		this.targets.rightArm.rot.set(0, 0, 0);
		this.targets.leftLeg.rot.set(0, 0, 0);
		this.targets.rightLeg.rot.set(0, 0, 0);
	}

	isRobotAction(value: string): value is RobotActionName {
		return value in robotActions;
	}

	setRobotAction(action: RobotActionName, btn?: HTMLElement | null) {
		if (this.currentAction !== action) {
			const currentDef = robotActions[this.currentAction];
			const shouldUsePost =
				this.actionPhase !== 'post' &&
				currentDef.post &&
				!(currentDef.tags?.includes('skipPost') ?? false) &&
				!this.mcpOverrideActive;
			if (shouldUsePost) {
				this.queuedAction = action;
				this.actionPhase = 'post';
				this.actionPhaseTimer = 0;
			} else {
				this.queuedAction = undefined;
				this.currentAction = action;
				this.actionPhaseTimer = 0;
				const hasPre = Boolean(robotActions[action].pre);
				this.actionPhase = hasPre ? 'pre' : 'main';
			}
		}
		if (btn) {
			document.querySelectorAll('.btn').forEach((b) => b.classList.remove('active'));
			btn.classList.add('active');
		}
		this.setEyeColor(this.currentAction);
	}

	resolveActionTransition(delta: number) {
		const actionDef = robotActions[this.currentAction];
		this.actionPhaseTimer += delta;
		if (this.actionPhase === 'pre') {
			const duration = actionDef.pre?.duration ?? 0;
			if (duration <= 0) {
				this.actionPhase = 'main';
				this.actionPhaseTimer = 0;
			} else if (this.actionPhaseTimer >= duration) {
				this.actionPhase = 'main';
				this.actionPhaseTimer -= duration;
			}
			return;
		}

		if (this.actionPhase === 'main') {
			return;
		}

		if (this.actionPhase === 'post') {
			const duration = actionDef.post?.duration ?? 0;
			if (duration <= 0 || this.actionPhaseTimer >= duration) {
				this.actionPhase = 'main';
				this.actionPhaseTimer = 0;
				if (this.queuedAction) {
					const nextAction = this.queuedAction;
					this.queuedAction = undefined;
					this.currentAction = nextAction;
					const hasPre = Boolean(robotActions[nextAction].pre);
					this.actionPhase = hasPre ? 'pre' : 'main';
					this.setEyeColor(this.currentAction);
				}
			}
		}
	}

	getFacingDot() {
		this.forwardDir.set(0, 0, 1).applyAxisAngle(this.yAxis, this.robot.rotation.y);
		this.toCameraDir.subVectors(this.camera.position, this.robot.position).setY(0);
		if (this.toCameraDir.lengthSq() < 0.0001) return 1;
		this.toCameraDir.normalize();
		return this.forwardDir.dot(this.toCameraDir);
	}

	private setEyeColor(action: RobotActionName) {
		const desired = robotActions[action].eyeColor;
		if (!desired || desired === 'cyan') {
			this.matEye.color.setHex(this.defaultEyeColorHex);
		} else if (desired === 'green') {
			this.matEye.color.setHex(this.successEyeColorHex);
		} else if (desired === 'red') {
			this.matEye.color.setHex(this.errorEyeColorHex);
		} else {
			this.matEye.color.setHex(getEyeColor(this.colors, desired));
		}
	}

	private createRipple(x: number, y: number) {
		const ripple = document.createElement('div');
		ripple.className = 'ripple';
		ripple.style.left = x + 'px';
		ripple.style.top = y + 'px';
		document.body.appendChild(ripple);
		setTimeout(() => ripple.remove(), 600);
	}

	private parseHexColor(value: string): number | undefined {
		const hex = parseInt(value.replace('#', ''), 16);
		return isNaN(hex) ? undefined : hex;
	}

	// ── Event handlers ───────────────────────────────────────────────

	private onWindowClick = (event: MouseEvent) => {
		if (!this.reactToClicks) {
			return;
		}
		this.createRipple(event.clientX, event.clientY);
		const rect = this.containerEl.getBoundingClientRect();
		const normalizedX = MathUtils.clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
		const maxYaw = 0.9;
		this.clickTargetRotation = normalizedX * maxYaw;
		const now = performance.now();
		const clickDelta = this.lastClickTime > 0 ? now - this.lastClickTime : 1000;
		this.lastClickTime = now;
		const rapidFactor = MathUtils.clamp((250 - clickDelta) / 250, 0, 1);
		this.clickTurnSpeed = MathUtils.lerp(0.06, 0.25, rapidFactor);
		const acceptChance = MathUtils.lerp(0.35, 0.85, MathUtils.clamp(clickDelta / 600, 0, 1));
		if (Math.random() > acceptChance) {
			return;
		}

		// Stop current action/destination before reacting — but never
		// interrupt an active prop interaction or cleanup walk
		if (this.interaction || this.cleanup) return;

		if (this.mcpOverrideActive) {
			this.mcpOverrideActive = false;
			this.mcpRequestedAction = 'idle';
			this.mcpDurationTimer = 0;
			if (this.mcpTimeoutId) {
				window.clearTimeout(this.mcpTimeoutId);
				this.mcpTimeoutId = 0;
			}
		}
		if (this.aiState === 'MOVING') {
			this.moveTarget.copy(this.robot.position);
			this.aiState = 'IDLE';
			this.aiTimer = 0;
		}

		const scheduleLookAt = () => {
			if (this.clickIntervalId) {
				clearInterval(this.clickIntervalId);
				this.clickIntervalId = undefined;
			}
			this.clickIntervalId = window.setInterval(() => {
				const currentDiff = normalizeRotation(this.clickTargetRotation - this.robot.rotation.y);
				if (Math.abs(currentDiff) < 0.02) {
					if (this.clickIntervalId) {
						clearInterval(this.clickIntervalId);
						this.clickIntervalId = undefined;
					}
				} else {
					this.robot.rotation.y += currentDiff * this.clickTurnSpeed;
				}
			}, 16);
		};

		// Clear any pending click timers
		if (this.clickTimeoutId) {
			clearTimeout(this.clickTimeoutId);
			this.clickTimeoutId = undefined;
		}
		if (this.clickIntervalId) {
			clearInterval(this.clickIntervalId);
			this.clickIntervalId = undefined;
		}

		// Attention-getting mechanism: robot responds based on current state
		const wasIdle = robotActions[this.currentAction].tags?.includes('idleLike') ?? false;
		const wasSleeping = robotActions[this.currentAction].tags?.includes('sleep') ?? false;
		const wasWorking = robotActions[this.currentAction].tags?.includes('work') ?? false;

		if (wasSleeping) {
			// Wake up with a brief knocked reaction then wave
			this.setRobotAction('knocked');
			scheduleLookAt();
			this.clickTimeoutId = window.setTimeout(() => {
				if (this.currentAction === 'knocked') {
					this.setRobotAction('wave');
					if (this.isAutoMode) {
						this.aiState = 'IDLE';
						this.aiTimer = 2;
					}
				}
				this.clickTimeoutId = undefined;
			}, 1500);
		} else if (wasWorking) {
			// Brief acknowledgment without fully interrupting - just look at camera
			scheduleLookAt();
			this.clickTimeoutId = window.setTimeout(() => {
				if (this.clickIntervalId) {
					clearInterval(this.clickIntervalId);
					this.clickIntervalId = undefined;
				}
				this.clickTimeoutId = undefined;
			}, 500);
		} else if (wasIdle) {
			// Friendly wave response
			this.setRobotAction('wave');
			scheduleLookAt();
			this.clickTimeoutId = window.setTimeout(() => {
				if (this.currentAction === 'wave') {
					this.setRobotAction('idle');
					if (this.isAutoMode) {
						this.aiState = 'IDLE';
						this.aiTimer = 0;
					}
				}
				this.clickTimeoutId = undefined;
			}, 2000);
		} else {
			// For any other action, try to look toward the click direction
			scheduleLookAt();
		}
	};

	private updateFocusState = () => {
		this.isUnfocused = document.hidden || !document.hasFocus();
		if (!this.isUnfocused) {
			this.unfocusedIdleTimer = 0;
			if (this.currentAction === 'peek' && !this.mcpOverrideActive && this.isAutoMode) {
				this.aiState = 'IDLE';
				this.aiTimer = 0;
				this.setRobotAction('idle');
			}
		}
	};

	private onMessage = (event: MessageEvent) => handleMessage(this, event);

	private scheduleResize = () => {
		if (this.resizeRaf) return;
		this.resizeRaf = requestAnimationFrame(() => {
			this.resizeRaf = 0;
			const width = this.containerEl.clientWidth;
			const height = this.containerEl.clientHeight;
			if (width === 0 || height === 0) return;
			this.camera.aspect = width / height;
			this.camera.updateProjectionMatrix();
			this.renderer.setSize(width, height);

			const minDimension = Math.min(width, height);
			const scaleFactor = Math.max(0.85, Math.min(1.25, minDimension / 720));
			this.moveBounds.x = 10 * scaleFactor;
			this.moveBounds.zRange = 6 * scaleFactor;
			this.moveBounds.zNear = 2 + (scaleFactor - 1) * 0.6;

			this.peekTargets[0].set(-0.7 * this.moveBounds.x, -0.4, 8.5 + this.moveBounds.zNear * 0.5);
			this.peekTargets[1].set(0.7 * this.moveBounds.x, -0.4, 8.5 + this.moveBounds.zNear * 0.5);
			this.peekTargets[2].set(0, -1.2, 9.2 + this.moveBounds.zNear * 0.6);
		});
	};

	// ── Message controller (RobotSceneController) ─────────────────────

	showToast(message: { text: string }) {
		if (typeof message.text === 'string') {
			this.addToast(message.text);
		}
	}

	applyConfig(message: SetConfigMessage) {
		if (typeof message.accentColor === 'string') {
			const hex = this.parseHexColor(message.accentColor);
			if (hex !== undefined) {
				this.matOrange.color.setHex(hex);
			}
		}
		if (typeof message.bodyColor === 'string') {
			const hex = this.parseHexColor(message.bodyColor);
			if (hex !== undefined) {
				this.matWhite.color.setHex(hex);
			}
		}
		if (typeof message.visorColor === 'string') {
			const hex = this.parseHexColor(message.visorColor);
			if (hex !== undefined) {
				this.matDark.color.setHex(hex);
			}
		}
		if (typeof message.limbColor === 'string') {
			const hex = this.parseHexColor(message.limbColor);
			if (hex !== undefined) {
				this.matMetal.color.setHex(hex);
			}
		}
		if (typeof message.defaultEyeColor === 'string') {
			const hex = this.parseHexColor(message.defaultEyeColor);
			if (hex !== undefined) {
				this.defaultEyeColorHex = hex;
			}
		}
		if (typeof message.successEyeColor === 'string') {
			const hex = this.parseHexColor(message.successEyeColor);
			if (hex !== undefined) {
				this.successEyeColorHex = hex;
			}
		}
		if (typeof message.errorEyeColor === 'string') {
			const hex = this.parseHexColor(message.errorEyeColor);
			if (hex !== undefined) {
				this.errorEyeColorHex = hex;
			}
		}
		// Re-apply current eye color after all color changes
		this.setEyeColor(this.currentAction);
		if (typeof message.idleAnimations === 'boolean') {
			this.isAutoMode = message.idleAnimations;
			if (this.isAutoMode) {
				this.aiState = 'IDLE';
				this.aiTimer = 0;
			}
		}
		if (typeof message.reactToClicks === 'boolean') {
			this.reactToClicks = message.reactToClicks;
		}
		if (typeof message.animationSpeed === 'number') {
			this.animationSpeedMultiplier = Math.max(0.2, Math.min(3.0, message.animationSpeed));
		}
		if (typeof message.movementSpeed === 'number') {
			this.movementSpeedMultiplier = Math.max(0.2, Math.min(3.0, message.movementSpeed));
		}
		if (typeof message.defaultTemperature === 'number') {
			this.currentTemperature = Math.max(0, Math.min(1, message.defaultTemperature));
		}
		if (typeof message.unfocusedSleepDelay === 'number') {
			this.unfocusedSleepDelay = Math.max(5, Math.min(300, message.unfocusedSleepDelay));
		}
		if (Array.isArray(message.disabledActions)) {
			this.disabledActions = new Set(message.disabledActions.filter((a: unknown) => typeof a === 'string'));
		}
		if (typeof message.showThoughtBubbles === 'boolean') {
			this.showThoughtBubblesRef.current = message.showThoughtBubbles;
		}
		if (typeof message.thoughtBubbleDuration === 'number') {
			this.thoughtBubbleDurationRef.current = Math.max(3, Math.min(30, message.thoughtBubbleDuration));
		}
	}

	setMood(message: SetMoodMessage) {
		if (typeof message.mood === 'string' && this.isRobotAction(message.mood)) {
			this.setRobotAction(message.mood);
			if (typeof message.message === 'string' && message.message) {
				this.addToast(message.message);
			}
			// Apply temperature if provided
			if (typeof message.temperature === 'number') {
				this.currentTemperature = Math.max(0, Math.min(1, message.temperature));
			}
			this.mcpRequestedAction = message.mood;
			this.mcpOverrideActive = message.mood !== 'idle';
			if (message.mood === 'walk') {
				this.aiState = 'MOVING';
				this.moveTarget.set(
					(Math.random() - 0.5) * this.moveBounds.x * 0.7,
					0,
					Math.random() * this.moveBounds.zRange + this.moveBounds.zNear + 2
				);
			}
			this.mcpDurationTimer = typeof message.durationSeconds === 'number' && message.durationSeconds > 0
				? message.durationSeconds
				: 0;
			if (this.mcpTimeoutId) {
				window.clearTimeout(this.mcpTimeoutId);
				this.mcpTimeoutId = 0;
			}
			if (this.mcpDurationTimer > 0 && this.mcpRequestedAction !== 'idle') {
				this.mcpTimeoutId = window.setTimeout(() => {
					this.mcpDurationTimer = 0;
				}, this.mcpDurationTimer * 1000);
			}
			if (!this.mcpOverrideActive) {
				this.aiState = 'IDLE';
				this.aiTimer = 0;
			}
		}
	}

	setAutopilot(message: { enabled: boolean }) {
		this.isAutoMode = message.enabled;
		if (this.isAutoMode) {
			this.aiState = 'IDLE';
			this.aiTimer = 0;
		}
	}

	setTemperature(message: { temperature: number }) {
		this.currentTemperature = Math.max(0, Math.min(1, message.temperature));
	}

	forceMove(message: { target: 'front' | 'left' | 'right' }) {
		const targetIndex = message.target === 'left' ? 0 : message.target === 'right' ? 1 : 2;
		const target = this.peekTargets[targetIndex];
		if (!target) {
			return;
		}
		this.mcpOverrideActive = false;
		this.mcpRequestedAction = undefined;
		this.mcpDurationTimer = 0;
		if (this.mcpTimeoutId) {
			window.clearTimeout(this.mcpTimeoutId);
			this.mcpTimeoutId = 0;
		}
		this.isAutoMode = true;
		this.aiState = 'MOVING';
		this.aiTimer = 4;
		this.moveTarget.copy(target);

		this.setRobotAction('walk');
	}

	// ─── Scene prop commands ─────────────────────────────────────────
	setScene(message: SetSceneMessage) {
		// Cancel any in-progress interaction
		this.interaction = null;
		this.sceneProps.clear();
		let autoInteractId: string | undefined;
		for (const entry of message.props as Array<{ propId: string; propType: string; label?: string; position?: string; autoInteract?: boolean }>) {
			if (!entry.propId || !entry.propType) continue;
			const coords = entry.position && SCENE_POSITION_COORDS[entry.position]
				? SCENE_POSITION_COORDS[entry.position]
				: { x: (Math.random() - 0.5) * 24, z: -8 + Math.random() * 9 };
			this.sceneProps.add(entry.propId, entry.propType as ScenePropType, coords.x, coords.z, Boolean(entry.autoInteract), entry.label);
			if (entry.autoInteract) autoInteractId = entry.propId;
		}
		if (autoInteractId) {
			startInteraction(this, autoInteractId, 5, 'none');
		}
	}

	placeSceneProp(message: PlaceScenePropMessage) {
		const coords = message.position && SCENE_POSITION_COORDS[message.position]
			? SCENE_POSITION_COORDS[message.position]
			: { x: (Math.random() - 0.5) * 24, z: -8 + Math.random() * 9 };
		this.sceneProps.add(message.propId, message.propType as ScenePropType, coords.x, coords.z, Boolean(message.autoInteract), typeof message.label === 'string' ? message.label : undefined);
		if (message.autoInteract) {
			const finish = (typeof message.finishBehavior === 'string' ? message.finishBehavior : 'none') as FinishBehavior;
			const dur = typeof message.durationSeconds === 'number' ? message.durationSeconds : 5;
			startInteraction(this, message.propId, dur, finish);
		}
	}

	removeSceneProp(message: { propId: string }) {
		// If we're interacting with this prop, cancel
		if (this.interaction?.propId === message.propId) {
			this.interaction = null;
			this.mcpOverrideActive = false;
			this.setRobotAction('idle');
			this.aiState = 'IDLE';
			this.aiTimer = 0;
		}
		this.sceneProps.remove(message.propId);
	}

	interactWithProp(message: InteractWithPropMessage) {
		const duration = typeof message.durationSeconds === 'number' ? message.durationSeconds : 5;
		const finish = (typeof message.finishBehavior === 'string' ? message.finishBehavior : 'none') as FinishBehavior;
		startInteraction(this, message.propId, duration, finish);
	}

	interactClosestProp() {
		// find nearest scene prop regardless of state
		let nearestId: string | null = null;
		let bestDist = Infinity;
		for (const sp of this.sceneProps.props.values()) {
			const dx = sp.worldX - this.robot.position.x;
			const dz = sp.worldZ - this.robot.position.z;
			const d = dx * dx + dz * dz;
			if (d < bestDist) {
				bestDist = d;
				nearestId = sp.id;
			}
		}
		if (nearestId) {
			startInteraction(this, nearestId, 0, 'none');
		}
	}

	// ── Lifecycle ────────────────────────────────────────────────────

	start() {
		window.addEventListener('click', this.onWindowClick);
		window.addEventListener('blur', this.updateFocusState);
		window.addEventListener('focus', this.updateFocusState);
		document.addEventListener('visibilitychange', this.updateFocusState);
		window.addEventListener('message', this.onMessage);
		this.resizeObserver = new ResizeObserver(this.scheduleResize);
		this.resizeObserver.observe(this.containerEl);
		window.addEventListener('resize', this.scheduleResize);
		this.scheduleResize();
		startRenderLoop(this);
		this.vscode.postMessage({ command: 'READY' });
	}

	dispose() {
		window.removeEventListener('click', this.onWindowClick);
		window.removeEventListener('blur', this.updateFocusState);
		window.removeEventListener('focus', this.updateFocusState);
		document.removeEventListener('visibilitychange', this.updateFocusState);
		window.removeEventListener('resize', this.scheduleResize);
		this.resizeObserver?.disconnect();
		window.removeEventListener('message', this.onMessage);
		cancelAnimationFrame(this.animationId);
		if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
		if (this.clickTimeoutId) clearTimeout(this.clickTimeoutId);
		if (this.clickIntervalId) clearInterval(this.clickIntervalId);
		if (this.thrownPropMesh) { this.scene.remove(this.thrownPropMesh); this.thrownPropMesh = null; }
		this.sceneProps.clear();
		this.renderer.dispose();
		this.containerEl.removeChild(this.renderer.domElement);
	}
}

/**
 * Build the robot scene, wire up its event handlers and render loop, and
 * return a cleanup function. Kept as the entry point so App.tsx's React shell
 * stays unchanged.
 */
export function setupRobotScene(opts: RobotSceneOptions): () => void {
	const scene = new RobotScene(opts);
	scene.start();
	return () => scene.dispose();
}
