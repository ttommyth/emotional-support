import { useCallback, useEffect, useRef, useState } from 'react';
import {
	AmbientLight,
	CapsuleGeometry,
	CircleGeometry,
	Clock,
	Color,
	CylinderGeometry,
	DirectionalLight,
	Fog,
	Group,
	MathUtils,
	Mesh,
	MeshBasicMaterial,
	MeshLambertMaterial,
	Object3D,
	PCFSoftShadowMap,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	ShadowMaterial,
	SphereGeometry,
	Vector3,
	WebGLRenderer
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry';
import { getActionsByTag, robotActions, actionPropDefs } from './robot/actions';
import { getEyeColor } from './robot/actions/eyes';
import { createRobotProps, updateProps } from './robot/actions/props';
import { createScenePropsManager, buildScenePropMesh } from './robot/scene-props';
import type { RobotActionContext, RobotActionName, RobotTargets, InteractionState, ScenePropType, FinishBehavior } from './robot/types';
import { SCENE_PROP_ACTION_MAP, SCENE_POSITION_COORDS, GROUND_Y } from './robot/types';

declare const acquireVsCodeApi: (() => { postMessage: (message: unknown) => void }) | undefined;

export default function App() {
	const [toasts, setToasts] = useState<Array<{ id: number; text: string; fading: boolean }>>([]);
	const toastIdRef = useRef(0);
	const showThoughtBubblesRef = useRef(true);
	const thoughtBubbleDurationRef = useRef(8);
	const bubbleContainerRef = useRef<HTMLDivElement>(null);
	/** Updated every frame from the render loop to position the bubble above the robot */
	const bubbleScreenPosRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.1 });

	const addToast = useCallback((text: string) => {
		if (!showThoughtBubblesRef.current || !text) return;
		const id = ++toastIdRef.current;
		setToasts((prev) => [...prev.slice(-1), { id, text, fading: false }]); // keep max 2
		const dur = thoughtBubbleDurationRef.current * 1000;
		setTimeout(() => {
			setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, fading: true } : t)));
		}, dur - 800);
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id));
		}, dur);
	}, []);

	useEffect(() => {
		const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : { postMessage: () => undefined };
		const container = document.getElementById('canvas-container') as HTMLDivElement | null;
		if (!container) {
			return;
		}
		const containerEl = container;

		const scene = new Scene();
		const computedStyles = getComputedStyle(document.body);
		const themeBackground = computedStyles.getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';
		const backgroundColor = new Color(themeBackground);
		scene.background = backgroundColor;
		scene.fog = new Fog(backgroundColor, 14, 55);

		const camera = new PerspectiveCamera(45, 1, 0.1, 1000);
		camera.position.set(0, 3.6, 18);

		const renderer = new WebGLRenderer({ antialias: true, alpha: true });
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = PCFSoftShadowMap;
		containerEl.appendChild(renderer.domElement);
		camera.lookAt(0, 2, 0);

		const ambientLight = new AmbientLight(0xffffff, 0.6);
		scene.add(ambientLight);

		const dirLight = new DirectionalLight(0xffffff, 1);
		dirLight.position.set(5, 15, 10);
		dirLight.castShadow = true;
		dirLight.shadow.mapSize.width = 2048;
		dirLight.shadow.mapSize.height = 2048;
		dirLight.shadow.bias = -0.0005;
		dirLight.shadow.camera.left = -20;
		dirLight.shadow.camera.right = 20;
		dirLight.shadow.camera.top = 20;
		dirLight.shadow.camera.bottom = -20;
		scene.add(dirLight);

		const planeGeometry = new PlaneGeometry(200, 200);
		const planeMaterial = new ShadowMaterial({ opacity: 0.1, color: 0x000000 });
		const plane = new Mesh(planeGeometry, planeMaterial);
		plane.rotation.x = -Math.PI / 2;
		plane.position.y = -4.8;
		scene.add(plane);

		const colors = {
			orange: 0xff9f43,
			white: 0xffffff,
			darkGray: 0x343a40,
			metal: 0xaabbaa,
			eyeCyan: 0x00d2d3,
			eyeRed: 0xff5252,
			eyeGreen: 0x1dd1a1,
			eyeOff: 0x333333,
			eyePurple: 0xa29bfe,
			eyeCalm: 0x5fbfc0
		};

		const matWhite = new MeshLambertMaterial({ color: colors.white });
		const matOrange = new MeshLambertMaterial({ color: colors.orange });
		const matDark = new MeshLambertMaterial({ color: colors.darkGray });
		const matMetal = new MeshLambertMaterial({ color: colors.metal });
		const matEye = new MeshBasicMaterial({ color: colors.eyeCyan });

		let defaultEyeColorHex = colors.eyeCyan;
		let successEyeColorHex = colors.eyeGreen;
		let errorEyeColorHex = colors.eyeRed;
		let animationSpeedMultiplier = 1.0;
		let movementSpeedMultiplier = 1.0;
		let reactToClicks = true;
		let disabledActions: Set<string> = new Set();
		/** Animation temperature 0–1. 0 = calm, 0.5 = normal, 1 = hyper */
		let currentTemperature = 0.5;

		const robot = new Group();
		robot.position.set(0, -0.6, 2.5);
		scene.add(robot);
		const bodyPivot = new Group();
		robot.add(bodyPivot);

		const torso = new Mesh(new RoundedBoxGeometry(3.5, 4.5, 2.5, 4, 0.5), matWhite);
		torso.castShadow = true;
		bodyPivot.add(torso);

		const chestPlate = new Mesh(new RoundedBoxGeometry(2, 1.4, 0.2, 4, 0.1), matOrange);
		chestPlate.position.set(0, 1, 1.3);
		chestPlate.castShadow = true;
		bodyPivot.add(chestPlate);

		const headGroup = new Group();
		headGroup.position.set(0, 3.5, 0);
		bodyPivot.add(headGroup);

		const headMesh = new Mesh(new RoundedBoxGeometry(5, 4, 3.5, 4, 0.2), matWhite);
		headMesh.castShadow = true;
		headGroup.add(headMesh);

		const visor = new Mesh(new RoundedBoxGeometry(4, 2.2, 0.5, 4, 0.1), matDark);
		visor.position.set(0, 0, 1.8);
		headGroup.add(visor);

		const leftEye = new Mesh(new CircleGeometry(0.4, 32), matEye);
		leftEye.position.set(-1, 0, 2.1);
		headGroup.add(leftEye);
		const rightEye = leftEye.clone();
		rightEye.position.set(1, 0, 2.1);
		headGroup.add(rightEye);

		const earGeo = new CylinderGeometry(0.6, 0.6, 0.5, 32);
		const leftEar = new Mesh(earGeo, matOrange);
		leftEar.rotation.z = Math.PI / 2;
		leftEar.position.set(-2.8, 0, 0);
		headGroup.add(leftEar);
		const rightEar = leftEar.clone();
		rightEar.position.set(2.8, 0, 0);
		headGroup.add(rightEar);

		const antennaStem = new Mesh(new CylinderGeometry(0.1, 0.3, 1, 16), matMetal);
		antennaStem.position.set(0, 2.5, 0);
		headGroup.add(antennaStem);
		const antennaBall = new Mesh(new SphereGeometry(0.4, 16, 16), matOrange);
		antennaBall.position.set(0, 3, 0);
		headGroup.add(antennaBall);

		function createLimb(x: number, y: number, isArm = false) {
			const group = new Group();
			group.position.set(x, y, 0);
			const limbMesh = new Mesh(new CapsuleGeometry(0.6, 2, 4, 8), isArm ? matMetal : matDark);
			limbMesh.position.y = -1;
			limbMesh.castShadow = true;
			group.add(limbMesh);
			if (isArm) {
				const hand = new Mesh(new SphereGeometry(0.8, 16, 16), matWhite);
				hand.position.y = -2.2;
				hand.castShadow = true;
				group.add(hand);
			} else {
				const foot = new Mesh(new RoundedBoxGeometry(1.2, 0.8, 1.8, 4, 0.2), matWhite);
				foot.position.set(0, -2, 0.5);
				foot.castShadow = true;
				group.add(foot);
			}
			return group;
		}

		const leftArm = createLimb(-2.2, 1.5, true);
		bodyPivot.add(leftArm);
		const rightArm = createLimb(2.2, 1.5, true);
		bodyPivot.add(rightArm);
		const leftLeg = createLimb(-1.2, -2.5, false);
		bodyPivot.add(leftLeg);
		const rightLeg = createLimb(1.2, -2.5, false);
		bodyPivot.add(rightLeg);

		const props = createRobotProps({ scene, bodyPivot }, actionPropDefs);

		const targets: RobotTargets = {
			body: { pos: new Vector3(), rot: new Vector3() },
			head: { pos: new Vector3(0, 3.5, 0), rot: new Vector3() },
			leftArm: { pos: new Vector3(-2.2, 1.5, 0), rot: new Vector3() },
			rightArm: { pos: new Vector3(2.2, 1.5, 0), rot: new Vector3() },
			leftLeg: { rot: new Vector3() },
			rightLeg: { rot: new Vector3() }
		};

		function resetTargets() {
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

		let currentAction: RobotActionName = 'idle';
		let queuedAction: RobotActionName | undefined;
		let actionPhase: 'pre' | 'main' | 'post' = 'main';
		let actionPhaseTimer = 0;
		let isAutoMode = true;
		let aiState = 'IDLE';
		let aiTimer = 0;
		let mcpOverrideActive = false;
		let mcpRequestedAction: RobotActionName | undefined;
		let mcpDurationTimer = 0;
		let mcpTimeoutId = 0;
		let isUnfocused = document.hidden || !document.hasFocus();
		let unfocusedIdleTimer = 0;
		let unfocusedSleepDelay = 20;
		
		// ─── Scene Props ─────────────────────────────────────────────────────
		const sceneProps = createScenePropsManager(scene);
		let interaction: InteractionState | null = null;

		const BEND_DURATION = 0.5;
		const GRAB_DURATION = 0.3;
		const RISE_DURATION = 0.4;
		const THROW_DURATION = 0.6;
		const TOSS_DURATION = 0.5;
		const PUT_DOWN_DURATION = 0.6;

		// ─── Ground-prop cleanup ─────────────────────────────────────────────
		/** Seconds a ground prop must sit before the robot considers cleaning it */
		const CLEANUP_ELIGIBLE_SECONDS = 8;
		type CleanupPhase = 'walking' | 'bending' | 'grabbing' | 'rising' | 'celebrate';
		type CleanupState = { phase: CleanupPhase; propName: string; timer: number };
		let cleanup: CleanupState | null = null;

		// ─── Thrown prop projectile ──────────────────────────────────────────
		let thrownPropMesh: Object3D | null = null;
		let thrownPropTimer = 0;
		let thrownPropDuration = 0;
		let thrownPropStart = new Vector3();
		let thrownPropEnd = new Vector3();
		let thrownPropPeak = 0; // Y height at apex
		let thrownPropSpin = 0;

		function launchThrownProp(type: ScenePropType, start: Vector3, end: Vector3, peak: number, duration: number, spin: number) {
			if (thrownPropMesh) {
				scene.remove(thrownPropMesh);
			}
			thrownPropMesh = buildScenePropMesh(type);
			thrownPropMesh.scale.set(0.7, 0.7, 0.7);
			scene.add(thrownPropMesh);
			thrownPropStart.copy(start);
			thrownPropEnd.copy(end);
			thrownPropPeak = peak;
			thrownPropDuration = duration;
			thrownPropTimer = 0;
			thrownPropSpin = spin;
		}

		function updateThrownProp(delta: number) {
			if (!thrownPropMesh) return;
			thrownPropTimer += delta;
			const p = Math.min(1, thrownPropTimer / thrownPropDuration);
			// Parabolic arc
			const x = thrownPropStart.x + (thrownPropEnd.x - thrownPropStart.x) * p;
			const z = thrownPropStart.z + (thrownPropEnd.z - thrownPropStart.z) * p;
			const baseY = thrownPropStart.y + (thrownPropEnd.y - thrownPropStart.y) * p;
			const arcY = 4 * thrownPropPeak * p * (1 - p);
			thrownPropMesh.position.set(x, baseY + arcY, z);
			thrownPropMesh.rotation.x += thrownPropSpin * delta;
			thrownPropMesh.rotation.z += thrownPropSpin * 0.7 * delta;
			if (p >= 1) {
				// Shrink and remove
				thrownPropMesh.scale.multiplyScalar(0.8);
				if (thrownPropMesh.scale.x < 0.05) {
					scene.remove(thrownPropMesh);
					thrownPropMesh = null;
				}
			}
		}

		function startInteraction(propId: string, durationAfterPickup: number, finishBehavior: FinishBehavior = 'none') {
			const prop = sceneProps.getById(propId);
			if (!prop) return;
			const targetAction = SCENE_PROP_ACTION_MAP[prop.type];
			if (!targetAction) return;
			prop.state = 'targeted';
			interaction = {
				phase: 'walking',
				propId,
				propType: prop.type,
				targetAction,
				timer: 0,
				durationAfterPickup,
				finishBehavior
			};
			// Override AI and start walking toward prop — stop just behind it
			mcpOverrideActive = true;
			aiState = 'MOVING';
			moveTarget.set(prop.worldX, 0, prop.worldZ + 0.3);
			setRobotAction('walk');
		}

		const moveTarget = new Vector3();
		const forwardDir = new Vector3(0, 0, 1);
		const toCameraDir = new Vector3();
		const yAxis = new Vector3(0, 1, 0);
    let currentSpeed = 0;
		/** Timer for the trip animation — counts up while tripped */
		let tripTimer = 0;
		let isTripActive = false;
		const TRIP_DURATION = 2.6; // must match tripped.ts export
		// base probability per second that the robot will trip while running
		// originally ~4%, bumping it up so trips feel more noticeable
		const TRIP_CHANCE_PER_SECOND = 0.04; // ~10% per second while running
		const moveBounds = { x: 10, zNear: 2, zRange: 6 };
		const peekTargets = [
			new Vector3(-7, -0.4, 8.5),
			new Vector3(7, -0.4, 8.5),
			new Vector3(0, -1.2, 9.2)
		];

		function getFacingDot() {
			forwardDir.set(0, 0, 1).applyAxisAngle(yAxis, robot.rotation.y);
			toCameraDir.subVectors(camera.position, robot.position).setY(0);
			if (toCameraDir.lengthSq() < 0.0001) return 1;
			toCameraDir.normalize();
			return forwardDir.dot(toCameraDir);
		}

		function createRipple(x: number, y: number) {
			const ripple = document.createElement('div');
			ripple.className = 'ripple';
			ripple.style.left = x + 'px';
			ripple.style.top = y + 'px';
			document.body.appendChild(ripple);
			setTimeout(() => ripple.remove(), 600);
		}

		const isRobotAction = (value: string): value is RobotActionName => value in robotActions;

		function setRobotAction(action: RobotActionName, btn?: HTMLElement | null) {
			if (currentAction !== action) {
				const currentDef = robotActions[currentAction];
				const shouldUsePost =
					actionPhase !== 'post' &&
					currentDef.post &&
					!(currentDef.tags?.includes('skipPost') ?? false) &&
					!mcpOverrideActive;
				if (shouldUsePost) {
					queuedAction = action;
					actionPhase = 'post';
					actionPhaseTimer = 0;
				} else {
					queuedAction = undefined;
					currentAction = action;
					actionPhaseTimer = 0;
					const hasPre = Boolean(robotActions[action].pre);
					actionPhase = hasPre ? 'pre' : 'main';
				}
			}
			if (btn) {
				document.querySelectorAll('.btn').forEach((b) => b.classList.remove('active'));
				btn.classList.add('active');
			}
			setEyeColor(currentAction);
		}

		function resolveActionTransition(delta: number) {
			const actionDef = robotActions[currentAction];
			actionPhaseTimer += delta;
			if (actionPhase === 'pre') {
				const duration = actionDef.pre?.duration ?? 0;
				if (duration <= 0) {
					actionPhase = 'main';
					actionPhaseTimer = 0;
				} else if (actionPhaseTimer >= duration) {
					actionPhase = 'main';
					actionPhaseTimer -= duration;
				}
				return;
			}

			if (actionPhase === 'main') {
				return;
			}

			if (actionPhase === 'post') {
				const duration = actionDef.post?.duration ?? 0;
				if (duration <= 0 || actionPhaseTimer >= duration) {
					actionPhase = 'main';
					actionPhaseTimer = 0;
					if (queuedAction) {
						const nextAction = queuedAction;
						queuedAction = undefined;
						currentAction = nextAction;
						const hasPre = Boolean(robotActions[nextAction].pre);
						actionPhase = hasPre ? 'pre' : 'main';
						setEyeColor(currentAction);
					}
				}
			}
		}

		function setEyeColor(action: RobotActionName) {
			const desired = robotActions[action].eyeColor;
			if (!desired || desired === 'cyan') {
				matEye.color.setHex(defaultEyeColorHex);
			} else if (desired === 'green') {
				matEye.color.setHex(successEyeColorHex);
			} else if (desired === 'red') {
				matEye.color.setHex(errorEyeColorHex);
			} else {
				matEye.color.setHex(getEyeColor(colors, desired));
			}
		}

		function updateAI(delta: number) {
			if (mcpOverrideActive) {
				if (mcpDurationTimer > 0) {
					mcpDurationTimer = Math.max(0, mcpDurationTimer - delta);
			if (mcpDurationTimer <= 0 && mcpRequestedAction && mcpRequestedAction !== 'idle') {
				mcpOverrideActive = false;
				mcpRequestedAction = 'idle';
				setRobotAction('idle');
				// Give autopilot a cooldown so it doesn't immediately pick a new action
				aiState = 'IDLE';
				aiTimer = 2 + Math.random() * 2;
			}
				}
			if (!(robotActions[currentAction].tags?.includes('movement') ?? false) || aiState !== 'MOVING') {
				return;
			}
			// MCP override walking (e.g. prop interaction) — fall through to
			// the MOVING branch below even when autopilot is off.
			}

			if ((!isAutoMode && !mcpOverrideActive) || robotActions[currentAction].tags?.includes('sleep')) return;

			aiTimer -= delta;

			if (aiState === 'IDLE') {
				if (aiTimer <= 0) {
// ── Check for props that need cleaning up ──
				if (!cleanup && !interaction && !disabledActions.has('tidyup') && !disabledActions.has('walk')) {
					// scene props which have sat too long
					const sceneIdle = Array.from(sceneProps.props.values())
						.filter(p => p.state === 'idle' && p.idleTimer >= CLEANUP_ELIGIBLE_SECONDS);
					if (sceneIdle.length > 0 && Math.random() < 0.6) {
						let nearest = sceneIdle[0];
						let bestDist = Infinity;
						for (const sp of sceneIdle) {
							const dx = sp.worldX - robot.position.x;
							const dz = sp.worldZ - robot.position.z;
							const d = dx * dx + dz * dz;
							if (d < bestDist) {
								bestDist = d;
								nearest = sp;
							}
						}
						startInteraction(nearest.id, 0, 'throw_away');
						return;
					}
						const groundProps = props.getGroundProps()
							.filter(gp => gp.timer >= CLEANUP_ELIGIBLE_SECONDS);
						if (groundProps.length > 0 && Math.random() < 0.6) {
							// Pick the nearest one
							let nearest = groundProps[0];
							let bestDist = Infinity;
							for (const gp of groundProps) {
								const dx = gp.x - robot.position.x;
								const dz = gp.z - robot.position.z;
								const d = dx * dx + dz * dz;
								if (d < bestDist) {
									bestDist = d;
									nearest = gp;
								}
							}
							startCleanup(nearest.name);
							return;
						}
					}

					const r = Math.random();
					const facingDot = getFacingDot();
					const isFacingAwayOrSide = facingDot < 0.2;
					let moveChance = 0.55;
					let performChance = 0.25;
					if (isFacingAwayOrSide) {
						moveChance = 0.7;
						performChance = 0.18;
					}
					if (r < moveChance) {
						if (disabledActions.has('walk')) {
							aiState = 'IDLE';
							aiTimer = 1;
						} else {
							aiState = 'MOVING';
							moveTarget.set(
								(Math.random() - 0.5) * moveBounds.x,
								0,
								(Math.random() - 0.5) * moveBounds.zRange + moveBounds.zNear
							);
							setRobotAction('walk');
						}
					} else if (r < moveChance + performChance) {
						const acts = getActionsByTag('idleFiller').filter((a) => !disabledActions.has(a));
						if (acts.length > 0) {
							setRobotAction(acts[Math.floor(Math.random() * acts.length)]);
						}
						aiState = 'PERFORMING';
						aiTimer = 3 + Math.random() * 4;
					} else {
						if (disabledActions.has('peek') || disabledActions.has('walk')) {
							aiState = 'IDLE';
							aiTimer = 1;
						} else {
							aiState = 'MOVING';
							const peekTarget = peekTargets[Math.floor(Math.random() * peekTargets.length)];
							moveTarget.copy(peekTarget);
							setRobotAction('walk');
						}
					}
				}
			} else if (aiState === 'MOVING') {
				const direction = new Vector3().subVectors(moveTarget, robot.position);
        const dist = direction.length();

        // CHANGE 2: Dynamic Speed & Action Selection Logic
        if (dist < 0.2 && !isTripActive) {
          robot.position.copy(moveTarget);
          currentSpeed = 0; // Reset speed on stop

          if (robot.position.z > 8) {
            aiState = 'PERFORMING';
            const isSidePeek = Math.abs(robot.position.x) > moveBounds.x * 0.2;
            setRobotAction(isSidePeek ? 'peek' : 'wave');
            aiTimer = isSidePeek ? 3.6 : 3;
            
            const targetRot = 0;
            let rotDiff = targetRot - robot.rotation.y;
            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
            robot.rotation.y = targetRot;
          } else {
            aiState = 'IDLE';
            setRobotAction('idle');
            aiTimer = 1;
          }
        } else {
          direction.normalize();
          
          // 1. Calculate Target Speed based on distance
          // Three tiers: far (>5) = fast(8), mid (>2) = walk(3.5), close = stroll(1.8)
          let targetSpeed: number;
          if (dist > 5) targetSpeed = 8;
          else if (dist > 2) targetSpeed = 3.5;
          else targetSpeed = 1.8;
          targetSpeed *= movementSpeedMultiplier;

          // 2. Apply Camera "Shyness" (Slow down if moving toward camera)
          toCameraDir.subVectors(camera.position, robot.position).setY(0);
          const towardCamera = toCameraDir.lengthSq() > 0.0001
            ? direction.dot(toCameraDir.normalize())
            : 0;
            
          // If moving towards camera, cap the max speed
          if (towardCamera > 0.2) targetSpeed = Math.min(targetSpeed, 3.5); 
          const speedScale = towardCamera > 0.2 ? 0.75 : towardCamera < -0.2 ? 1.15 : 1;
          targetSpeed *= speedScale;

          // 3. Smooth Acceleration/Deceleration (Lerp currentSpeed)
          // factor of 4 * delta gives a nice weight (adjust for inertia)
          currentSpeed = MathUtils.lerp(currentSpeed, targetSpeed, delta * 4);

          // 4. Move Robot
          robot.position.addScaledVector(direction, currentSpeed * delta);

          // 5. Pick Correct Action (Run vs Walk vs Stroll) + Trip
          const isLocomotion = currentAction === 'walk' || currentAction === 'running' || currentAction === 'stroll';

          // Helper: determine if we're currently over an idle scene prop
          function isOverIdleProp(): boolean {
            for (const sp of sceneProps.props.values()) {
              if (sp.state !== 'idle') continue;
              const dx = sp.worldX - robot.position.x;
              const dz = sp.worldZ - robot.position.z;
              if (dx * dx + dz * dz < 1.0) {
                return true;
              }
            }
            return false;
          }

          // Handle active trip animation
          if (isTripActive) {
            tripTimer += delta;
            // Slow down during trip
            currentSpeed = MathUtils.lerp(currentSpeed, 0, delta * 3);
            if (tripTimer >= TRIP_DURATION) {
              isTripActive = false;
              tripTimer = 0;
              // Resume walking after recovery
              setRobotAction('walk');
            }
          } else if (isLocomotion) {
            // Random trip while running, but only if over a prop
            if (
              currentAction === 'running' &&
              isOverIdleProp() &&
              Math.random() < TRIP_CHANCE_PER_SECOND * delta
            ) {
              isTripActive = true;
              tripTimer = 0;
              setRobotAction('tripped');
            } else {
              // Three-tier locomotion selection
              const runThreshold = 5.5;
              const strollThreshold = 2.2;
              let correctAction: RobotActionName;
              if (currentSpeed > runThreshold && isRobotAction('running')) {
                correctAction = 'running';
              } else if (currentSpeed < strollThreshold && isRobotAction('stroll')) {
                correctAction = 'stroll';
              } else {
                correctAction = 'walk';
              }
              setRobotAction(correctAction);
            }
          }

          // 6. Rotation Logic (Existing)
          const targetRot = Math.atan2(direction.x, direction.z);
          let rotDiff = targetRot - robot.rotation.y;
          while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
          while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
          
          // Rotate faster if we are moving faster
          const turnSpeed = Math.max(0.1, currentSpeed * 0.03); 
          robot.rotation.y += rotDiff * turnSpeed;
        }
			} else if (aiState === 'PERFORMING') {
				if (aiTimer <= 0) {
					aiState = 'IDLE';
					setRobotAction('idle');
					aiTimer = 0.5;
				}
			}
		}

		function updateInteraction(delta: number) {
			if (!interaction) return;
			const prop = sceneProps.getById(interaction.propId);

			if (interaction.phase === 'walking') {
				// Check if robot has arrived near the target
				const dx = moveTarget.x - robot.position.x;
				const dz = moveTarget.z - robot.position.z;
				const dist = Math.sqrt(dx * dx + dz * dz);
				if (dist < 0.5) {
					// Arrived — face toward the prop then bend
					if (prop) {
						const toPropX = prop.worldX - robot.position.x;
						const toPropZ = prop.worldZ - robot.position.z;
						robot.rotation.y = Math.atan2(toPropX, toPropZ);
					}
					interaction.phase = 'bending';
					interaction.timer = 0;
					currentSpeed = 0;
					aiState = 'IDLE';
					setRobotAction('idle');
				}
				return;
			}

			interaction.timer += delta;

			if (interaction.phase === 'bending') {
				// Bend body forward and down
				const p = Math.min(1, interaction.timer / BEND_DURATION);
				const eased = p * p * (3 - 2 * p); // smoothstep
				targets.body.pos.set(0, -1.5 * eased, 0.5 * eased);
				targets.body.rot.set(0.6 * eased, 0, 0);
				targets.leftArm.rot.set(-0.8 * eased, 0, 0.3 * eased);
				targets.rightArm.rot.set(-0.8 * eased, 0, -0.3 * eased);
				if (p >= 1) {
					interaction.phase = 'grabbing';
					interaction.timer = 0;
					if (prop) {
						prop.state = 'grabbed';
						// Hide ground mesh immediately so it doesn't linger
						prop.mesh.visible = false;
					}
				}
				return;
			}

			if (interaction.phase === 'grabbing') {
				// Hold bent pose briefly while prop shrinks
				targets.body.pos.set(0, -1.5, 0.5);
				targets.body.rot.set(0.6, 0, 0);
				targets.leftArm.rot.set(-0.8, 0, 0.3);
				targets.rightArm.rot.set(-0.8, 0, -0.3);
				if (interaction.timer >= GRAB_DURATION) {
					interaction.phase = 'rising';
					interaction.timer = 0;
				}
				return;
			}

			if (interaction.phase === 'rising') {
				// Rise back to standing
				const p = Math.min(1, interaction.timer / RISE_DURATION);
				const eased = p * p * (3 - 2 * p);
				targets.body.pos.set(0, -1.5 * (1 - eased), 0.5 * (1 - eased));
				targets.body.rot.set(0.6 * (1 - eased), 0, 0);
				targets.leftArm.rot.set(-0.8 * (1 - eased), 0, 0.3 * (1 - eased));
				targets.rightArm.rot.set(-0.8 * (1 - eased), 0, -0.3 * (1 - eased));
				if (p >= 1) {
					// Transition to performing the action
					const targetAction = interaction.targetAction;
					const duration = interaction.durationAfterPickup;
					interaction.phase = 'performing';
					interaction.timer = 0;
					setRobotAction(targetAction);
					mcpOverrideActive = true;
					mcpRequestedAction = targetAction;
					mcpDurationTimer = duration > 0 ? duration : 0;
					if (mcpTimeoutId) {
						window.clearTimeout(mcpTimeoutId);
						mcpTimeoutId = 0;
					}
					if (mcpDurationTimer > 0) {
						mcpTimeoutId = window.setTimeout(() => {
							mcpDurationTimer = 0;
						}, mcpDurationTimer * 1000);
					}
				}
				return;
			}

			if (interaction.phase === 'performing') {
				// Wait for MCP duration to expire, then trigger finish behavior
				if (mcpDurationTimer <= 0) {
					const finish = interaction.finishBehavior;
					if (finish === 'throw_away') {
						interaction.phase = 'throwing';
						interaction.timer = 0;
						setRobotAction('idle');
					} else if (finish === 'throw_up') {
						interaction.phase = 'tossing';
						interaction.timer = 0;
						setRobotAction('idle');
					} else if (finish === 'put_down') {
						interaction.phase = 'putting_down';
						interaction.timer = 0;
						setRobotAction('idle');
					} else {
						// No finish behavior — just end
						interaction = null;
						mcpOverrideActive = false;
						setRobotAction('idle');
						aiState = 'IDLE';
						aiTimer = 0.5;
					}
				}
				return;
			}

			if (interaction.phase === 'throwing') {
				// Angry throw animation: wind up then hurl forward
				const p = Math.min(1, interaction.timer / THROW_DURATION);
				if (p < 0.4) {
					// Wind up — pull arm back
					const wp = p / 0.4;
					targets.body.rot.set(0, -0.3 * wp, 0);
					targets.rightArm.rot.set(-1.5 * wp, 0, -0.5 * wp);
					targets.leftArm.rot.set(0.3 * wp, 0, 0.3 * wp);
				} else {
					// Throw forward
					const tp = (p - 0.4) / 0.6;
					const te = tp * tp * (3 - 2 * tp);
					targets.body.rot.set(0.2 * te, 0.4 * te, 0);
					targets.rightArm.rot.set(1.2 * te - 1.5 * (1 - te), 0, -0.3);
					targets.leftArm.rot.set(-0.2, 0, 0.3);
					if (tp > 0.1 && !thrownPropMesh) {
						// Launch the prop
						const startPos = new Vector3();
						robot.getWorldPosition(startPos);
						startPos.y += 2;
						const throwDir = new Vector3(0, 0, 1).applyAxisAngle(new Vector3(0, 1, 0), robot.rotation.y);
						const endPos = startPos.clone().addScaledVector(throwDir, 8);
						endPos.y = GROUND_Y;
						launchThrownProp(interaction.propType, startPos, endPos, 2, 0.8, 12);
					}
				}
				if (p >= 1) {
					interaction = null;
					mcpOverrideActive = false;
					aiState = 'IDLE';
					aiTimer = 0.5;
				}
				return;
			}

			if (interaction.phase === 'tossing') {
				// Celebratory toss — throw prop straight up with joy
				const p = Math.min(1, interaction.timer / TOSS_DURATION);
				if (p < 0.3) {
					// Crouch down a bit then spring up
					const wp = p / 0.3;
					targets.body.pos.set(0, -0.5 * wp, 0);
					targets.leftArm.rot.set(-0.5 * wp, 0, 0.3 * wp);
					targets.rightArm.rot.set(-0.5 * wp, 0, -0.3 * wp);
				} else {
					// Spring up, arms go high
					const tp = (p - 0.3) / 0.7;
					const te = tp * tp * (3 - 2 * tp);
					targets.body.pos.set(0, 0.5 * te, 0);
					targets.leftArm.rot.set(-2.5 * te, 0, 0.5 * te);
					targets.rightArm.rot.set(-2.5 * te, 0, -0.5 * te);
					if (tp > 0.05 && !thrownPropMesh) {
						const startPos = new Vector3();
						robot.getWorldPosition(startPos);
						startPos.y += 4;
						const endPos = startPos.clone();
						endPos.y += 12;
						launchThrownProp(interaction.propType, startPos, endPos, 6, 1.5, 5);
					}
				}
				if (p >= 1) {
					interaction = null;
					mcpOverrideActive = false;
					setRobotAction('success');
					mcpOverrideActive = true;
					mcpRequestedAction = 'success';
					mcpDurationTimer = 2;
					if (mcpTimeoutId) { window.clearTimeout(mcpTimeoutId); mcpTimeoutId = 0; }
					mcpTimeoutId = window.setTimeout(() => { mcpDurationTimer = 0; }, 2000);
				}
				return;
			}

			if (interaction.phase === 'putting_down') {
				// Gently place prop back on ground
				const p = Math.min(1, interaction.timer / PUT_DOWN_DURATION);
				if (p < 0.5) {
					// Bend down
					const bp = p / 0.5;
					const be = bp * bp * (3 - 2 * bp);
					targets.body.pos.set(0, -1.2 * be, 0.4 * be);
					targets.body.rot.set(0.5 * be, 0, 0);
					targets.leftArm.rot.set(-0.6 * be, 0, 0.2 * be);
					targets.rightArm.rot.set(-0.6 * be, 0, -0.2 * be);
				} else {
					// Rise back up (prop left on ground)
					const rp = (p - 0.5) / 0.5;
					const re = rp * rp * (3 - 2 * rp);
					targets.body.pos.set(0, -1.2 * (1 - re), 0.4 * (1 - re));
					targets.body.rot.set(0.5 * (1 - re), 0, 0);
					targets.leftArm.rot.set(-0.6 * (1 - re), 0, 0.2 * (1 - re));
					targets.rightArm.rot.set(-0.6 * (1 - re), 0, -0.2 * (1 - re));
					if (rp > 0.1 && !thrownPropMesh) {
						// Place a new prop on the ground at robot's position
						const placeX = robot.position.x + Math.sin(robot.rotation.y) * 1.5;
						const placeZ = robot.position.z + Math.cos(robot.rotation.y) * 1.5;
						sceneProps.add(`placed-${Date.now()}`, interaction.propType, placeX, placeZ, false);
					}
				}
				if (p >= 1) {
					interaction = null;
					mcpOverrideActive = false;
					setRobotAction('idle');
					aiState = 'IDLE';
					aiTimer = 0.5;
				}
				return;
			}
		}

		/**
		 * Start cleaning up a ground prop (action prop that fell).
		 * The robot walks to it, bends down, picks it up, and does
		 * a little satisfied reaction.
		 */
		function startCleanup(propName: string) {
			const propState = props.get(propName);
			if (!propState || propState.state !== 'ground') return;
			cleanup = { phase: 'walking', propName, timer: 0 };
			mcpOverrideActive = true; // ensure walking works even with autopilot off
			aiState = 'MOVING';
			moveTarget.set(propState.mesh.position.x, 0, propState.mesh.position.z + 0.5);
			setRobotAction('walk');
		}

		/**
		 * Per-frame update for the ground-prop cleanup state machine.
		 */
		function updateCleanup(delta: number) {
			if (!cleanup) return;
			const propState = props.get(cleanup.propName);

			// If the prop vanished (auto-faded) while we were going there, abort
			if (!propState || propState.state !== 'ground') {
				cleanup = null;
				mcpOverrideActive = false;
				setRobotAction('idle');
				aiState = 'IDLE';
				aiTimer = 0.5;
				return;
			}

			if (cleanup.phase === 'walking') {
				const dx = moveTarget.x - robot.position.x;
				const dz = moveTarget.z - robot.position.z;
				const dist = Math.sqrt(dx * dx + dz * dz);
				if (dist < 0.5) {
					// Face the prop
					const toPropX = propState.mesh.position.x - robot.position.x;
					const toPropZ = propState.mesh.position.z - robot.position.z;
					robot.rotation.y = Math.atan2(toPropX, toPropZ);
					cleanup.phase = 'bending';
					cleanup.timer = 0;
					currentSpeed = 0;
					aiState = 'IDLE';
					setRobotAction('tidyup');
				}
				return;
			}

			cleanup.timer += delta;

			if (cleanup.phase === 'bending') {
				// Bend forward (same motion as scene-prop interaction)
				const p = Math.min(1, cleanup.timer / BEND_DURATION);
				const eased = p * p * (3 - 2 * p);
				targets.body.pos.set(0, -1.5 * eased, 0.5 * eased);
				targets.body.rot.set(0.6 * eased, 0, 0);
				targets.leftArm.rot.set(-0.8 * eased, 0, 0.3 * eased);
				targets.rightArm.rot.set(-0.8 * eased, 0, -0.3 * eased);
				if (p >= 1) {
					cleanup.phase = 'grabbing';
					cleanup.timer = 0;
					// Immediately hide the ground prop
					propState.state = 'hidden';
					propState.groundTimer = 0;
					propState.mesh.visible = false;
					propState.mesh.scale.set(0, 0, 0);
				}
				return;
			}

			if (cleanup.phase === 'grabbing') {
				// Hold bent pose briefly
				targets.body.pos.set(0, -1.5, 0.5);
				targets.body.rot.set(0.6, 0, 0);
				targets.leftArm.rot.set(-0.8, 0, 0.3);
				targets.rightArm.rot.set(-0.8, 0, -0.3);
				if (cleanup.timer >= GRAB_DURATION) {
					cleanup.phase = 'rising';
					cleanup.timer = 0;
				}
				return;
			}

			if (cleanup.phase === 'rising') {
				// Stand back up
				const p = Math.min(1, cleanup.timer / RISE_DURATION);
				const eased = p * p * (3 - 2 * p);
				targets.body.pos.set(0, -1.5 * (1 - eased), 0.5 * (1 - eased));
				targets.body.rot.set(0.6 * (1 - eased), 0, 0);
				targets.leftArm.rot.set(-0.8 * (1 - eased), 0, 0.3 * (1 - eased));
				targets.rightArm.rot.set(-0.8 * (1 - eased), 0, -0.3 * (1 - eased));
				if (p >= 1) {
					cleanup.phase = 'celebrate';
					cleanup.timer = 0;
					setRobotAction('success');
				}
				return;
			}

			if (cleanup.phase === 'celebrate') {
				// Brief satisfied reaction then done
				if (cleanup.timer >= 1.5) {
					cleanup = null;
					mcpOverrideActive = false;
					setRobotAction('idle');
					aiState = 'IDLE';
					aiTimer = 1 + Math.random() * 2;
				}
			}
		}

		const actionContext: RobotActionContext = {
			targets,
			props,
			headGroup,
			robot,
			camera,
			temperature: 0.5
		};

		const clock = new Clock();
		let isBlinking = false;
		let blinkTimer = 0;
		let timeSinceLastBlink = 0;
		const blinkDuration = 0.15;
		let animationId = 0;

		// Track click interaction timers for cleanup
		let clickTimeoutId: number | undefined;
		let clickIntervalId: number | undefined;
		let lastClickTime = 0;
		let clickTargetRotation = 0;
		let clickTurnSpeed = 0.08;

		// Helper function to normalize rotation angle to -π to π range
		const normalizeRotation = (rotDiff: number): number => {
			while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
			while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
			return rotDiff;
		};

		const onWindowClick = (event: MouseEvent) => {
			if (!reactToClicks) {
				return;
			}
			createRipple(event.clientX, event.clientY);
			const rect = containerEl.getBoundingClientRect();
			const normalizedX = MathUtils.clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
			const maxYaw = 0.9;
			clickTargetRotation = normalizedX * maxYaw;
			const now = performance.now();
			const clickDelta = lastClickTime > 0 ? now - lastClickTime : 1000;
			lastClickTime = now;
			const rapidFactor = MathUtils.clamp((250 - clickDelta) / 250, 0, 1);
			clickTurnSpeed = MathUtils.lerp(0.06, 0.25, rapidFactor);
			const acceptChance = MathUtils.lerp(0.35, 0.85, MathUtils.clamp(clickDelta / 600, 0, 1));
			if (Math.random() > acceptChance) {
				return;
			}

			// Stop current action/destination before reacting — but never
			// interrupt an active prop interaction or cleanup walk
			if (interaction || cleanup) return;

			if (mcpOverrideActive) {
				mcpOverrideActive = false;
				mcpRequestedAction = 'idle';
				mcpDurationTimer = 0;
				if (mcpTimeoutId) {
					window.clearTimeout(mcpTimeoutId);
					mcpTimeoutId = 0;
				}
			}
			if (aiState === 'MOVING') {
				moveTarget.copy(robot.position);
				aiState = 'IDLE';
				aiTimer = 0;
			}

			const scheduleLookAt = () => {
				if (clickIntervalId) {
					clearInterval(clickIntervalId);
					clickIntervalId = undefined;
				}
				clickIntervalId = window.setInterval(() => {
					const currentDiff = normalizeRotation(clickTargetRotation - robot.rotation.y);
					if (Math.abs(currentDiff) < 0.02) {
						if (clickIntervalId) {
							clearInterval(clickIntervalId);
							clickIntervalId = undefined;
						}
					} else {
						robot.rotation.y += currentDiff * clickTurnSpeed;
					}
				}, 16);
			};

			// Clear any pending click timers
			if (clickTimeoutId) {
				clearTimeout(clickTimeoutId);
				clickTimeoutId = undefined;
			}
			if (clickIntervalId) {
				clearInterval(clickIntervalId);
				clickIntervalId = undefined;
			}

			// Attention-getting mechanism: robot responds based on current state
			const wasIdle = robotActions[currentAction].tags?.includes('idleLike') ?? false;
			const wasSleeping = robotActions[currentAction].tags?.includes('sleep') ?? false;
			const wasWorking = robotActions[currentAction].tags?.includes('work') ?? false;

			if (wasSleeping) {
				// Wake up with a brief knocked reaction then wave
				setRobotAction('knocked');
				scheduleLookAt();
				clickTimeoutId = window.setTimeout(() => {
					if (currentAction === 'knocked') {
						setRobotAction('wave');
						if (isAutoMode) {
							aiState = 'IDLE';
							aiTimer = 2;
						}
					}
					clickTimeoutId = undefined;
				}, 1500);
			} else if (wasWorking) {
				// Brief acknowledgment without fully interrupting - just look at camera
				scheduleLookAt();
				clickTimeoutId = window.setTimeout(() => {
					if (clickIntervalId) {
						clearInterval(clickIntervalId);
						clickIntervalId = undefined;
					}
					clickTimeoutId = undefined;
				}, 500);
			} else if (wasIdle) {
				// Friendly wave response
				setRobotAction('wave');
				scheduleLookAt();
				clickTimeoutId = window.setTimeout(() => {
					if (currentAction === 'wave') {
						setRobotAction('idle');
						if (isAutoMode) {
							aiState = 'IDLE';
							aiTimer = 0;
						}
					}
					clickTimeoutId = undefined;
				}, 2000);
			} else {
				// For any other action, try to look toward the click direction
				scheduleLookAt();
			}
		};

		window.addEventListener('click', onWindowClick);

		const updateFocusState = () => {
			isUnfocused = document.hidden || !document.hasFocus();
			if (!isUnfocused) {
				unfocusedIdleTimer = 0;
				if (currentAction === 'peek' && !mcpOverrideActive && isAutoMode) {
					aiState = 'IDLE';
					aiTimer = 0;
					setRobotAction('idle');
				}
			}
		};
		window.addEventListener('blur', updateFocusState);
		window.addEventListener('focus', updateFocusState);
		document.addEventListener('visibilitychange', updateFocusState);

		const parseHexColor = (value: string): number | undefined => {
			const hex = parseInt(value.replace('#', ''), 16);
			return isNaN(hex) ? undefined : hex;
		};

		const onMessage = (event: MessageEvent) => {
			const message = event.data;
			if (message?.command === 'SET_CONFIG') {
				if (typeof message.accentColor === 'string') {
					const hex = parseHexColor(message.accentColor);
					if (hex !== undefined) {
						matOrange.color.setHex(hex);
					}
				}
				if (typeof message.bodyColor === 'string') {
					const hex = parseHexColor(message.bodyColor);
					if (hex !== undefined) {
						matWhite.color.setHex(hex);
					}
				}
				if (typeof message.visorColor === 'string') {
					const hex = parseHexColor(message.visorColor);
					if (hex !== undefined) {
						matDark.color.setHex(hex);
					}
				}
				if (typeof message.limbColor === 'string') {
					const hex = parseHexColor(message.limbColor);
					if (hex !== undefined) {
						matMetal.color.setHex(hex);
					}
				}
				if (typeof message.defaultEyeColor === 'string') {
					const hex = parseHexColor(message.defaultEyeColor);
					if (hex !== undefined) {
						defaultEyeColorHex = hex;
					}
				}
				if (typeof message.successEyeColor === 'string') {
					const hex = parseHexColor(message.successEyeColor);
					if (hex !== undefined) {
						successEyeColorHex = hex;
					}
				}
				if (typeof message.errorEyeColor === 'string') {
					const hex = parseHexColor(message.errorEyeColor);
					if (hex !== undefined) {
						errorEyeColorHex = hex;
					}
				}
				// Re-apply current eye color after all color changes
				setEyeColor(currentAction);
				if (typeof message.idleAnimations === 'boolean') {
					isAutoMode = message.idleAnimations;
					if (isAutoMode) {
						aiState = 'IDLE';
						aiTimer = 0;
					}
				}
				if (typeof message.reactToClicks === 'boolean') {
					reactToClicks = message.reactToClicks;
				}
				if (typeof message.animationSpeed === 'number') {
					animationSpeedMultiplier = Math.max(0.2, Math.min(3.0, message.animationSpeed));
				}
				if (typeof message.movementSpeed === 'number') {
					movementSpeedMultiplier = Math.max(0.2, Math.min(3.0, message.movementSpeed));
				}
				if (typeof message.defaultTemperature === 'number') {
					currentTemperature = Math.max(0, Math.min(1, message.defaultTemperature));
				}
				if (typeof message.unfocusedSleepDelay === 'number') {
					unfocusedSleepDelay = Math.max(5, Math.min(300, message.unfocusedSleepDelay));
				}
				if (Array.isArray(message.disabledActions)) {
					disabledActions = new Set(message.disabledActions.filter((a: unknown) => typeof a === 'string'));
				}
				if (typeof message.showThoughtBubbles === 'boolean') {
					showThoughtBubblesRef.current = message.showThoughtBubbles;
				}
				if (typeof message.thoughtBubbleDuration === 'number') {
					thoughtBubbleDurationRef.current = Math.max(3, Math.min(30, message.thoughtBubbleDuration));
				}
				return;
			}
			if (message?.command === 'SHOW_TOAST' && typeof message?.text === 'string') {
				addToast(message.text);
				return;
			}
			if (message?.command === 'SET_MOOD' && typeof message?.mood === 'string' && isRobotAction(message.mood)) {
				setRobotAction(message.mood);
				if (typeof message.message === 'string' && message.message) {
					addToast(message.message);
				}
				// Apply temperature if provided
				if (typeof message.temperature === 'number') {
					currentTemperature = Math.max(0, Math.min(1, message.temperature));
				}
				mcpRequestedAction = message.mood;
				mcpOverrideActive = message.mood !== 'idle';
				if (message.mood === 'walk') {
					aiState = 'MOVING';
					moveTarget.set(
						(Math.random() - 0.5) * moveBounds.x * 0.7,
						0,
						Math.random() * moveBounds.zRange + moveBounds.zNear + 2
					);
					
				}
				mcpDurationTimer = typeof message?.durationSeconds === 'number' && message.durationSeconds > 0
					? message.durationSeconds
					: 0;
				if (mcpTimeoutId) {
					window.clearTimeout(mcpTimeoutId);
					mcpTimeoutId = 0;
				}
				if (mcpDurationTimer > 0 && mcpRequestedAction !== 'idle') {
					mcpTimeoutId = window.setTimeout(() => {
						mcpDurationTimer = 0;
					}, mcpDurationTimer * 1000);
				}
				if (!mcpOverrideActive) {
					aiState = 'IDLE';
					aiTimer = 0;
				}
				return;
			}
			if (message?.command === 'SET_AUTOPILOT' && typeof message?.enabled === 'boolean') {
				isAutoMode = message.enabled;
				if (isAutoMode) {
					aiState = 'IDLE';
					aiTimer = 0;
				}
				return;
			}
			if (message?.command === 'SET_TEMPERATURE' && typeof message?.temperature === 'number') {
				currentTemperature = Math.max(0, Math.min(1, message.temperature));
				return;
			}
			if (message?.command === 'FORCE_MOVE' && typeof message?.target === 'string') {
				const targetIndex = message.target === 'left' ? 0 : message.target === 'right' ? 1 : 2;
				const target = peekTargets[targetIndex];
				if (!target) {
					return;
				}
				mcpOverrideActive = false;
				mcpRequestedAction = undefined;
				mcpDurationTimer = 0;
				if (mcpTimeoutId) {
					window.clearTimeout(mcpTimeoutId);
					mcpTimeoutId = 0;
				}
				isAutoMode = true;
				aiState = 'MOVING';
				aiTimer = 4;
				moveTarget.copy(target);

				setRobotAction('walk');
				return;
			}
			// ─── Scene prop commands ─────────────────────────────────────────
			if (message?.command === 'SET_SCENE' && Array.isArray(message?.props)) {
				// Cancel any in-progress interaction
				interaction = null;
				sceneProps.clear();
				let autoInteractId: string | undefined;
				for (const entry of message.props as Array<{ propId: string; propType: string; label?: string; position?: string; autoInteract?: boolean }>) {
					if (!entry.propId || !entry.propType) continue;
					const coords = entry.position && SCENE_POSITION_COORDS[entry.position]
						? SCENE_POSITION_COORDS[entry.position]
						: { x: (Math.random() - 0.5) * 24, z: -8 + Math.random() * 9 };
					sceneProps.add(entry.propId, entry.propType as ScenePropType, coords.x, coords.z, Boolean(entry.autoInteract), entry.label);
					if (entry.autoInteract) autoInteractId = entry.propId;
				}
				if (autoInteractId) {
					startInteraction(autoInteractId, 5, 'none');
				}
				return;
			}
			if (message?.command === 'PLACE_SCENE_PROP' && typeof message?.propId === 'string' && typeof message?.propType === 'string') {
				const coords = message.position && SCENE_POSITION_COORDS[message.position]
					? SCENE_POSITION_COORDS[message.position]
					: { x: (Math.random() - 0.5) * 24, z: -8 + Math.random() * 9 };
				sceneProps.add(message.propId, message.propType as ScenePropType, coords.x, coords.z, Boolean(message.autoInteract), typeof message.label === 'string' ? message.label : undefined);
				if (message.autoInteract) {
					const finish = (typeof message.finishBehavior === 'string' ? message.finishBehavior : 'none') as FinishBehavior;
					const dur = typeof message.durationSeconds === 'number' ? message.durationSeconds : 5;
					startInteraction(message.propId, dur, finish);
				}
				return;
			}
			if (message?.command === 'REMOVE_SCENE_PROP' && typeof message?.propId === 'string') {
				// If we're interacting with this prop, cancel
				if (interaction?.propId === message.propId) {
					interaction = null;
					mcpOverrideActive = false;
					setRobotAction('idle');
					aiState = 'IDLE';
					aiTimer = 0;
				}
				sceneProps.remove(message.propId);
				return;
			}
			if (message?.command === 'INTERACT_WITH_PROP' && typeof message?.propId === 'string') {
				const duration = typeof message.durationSeconds === 'number' ? message.durationSeconds : 5;
				const finish = (typeof message.finishBehavior === 'string' ? message.finishBehavior : 'none') as FinishBehavior;
				startInteraction(message.propId, duration, finish);
				return;
			}
		};
		window.addEventListener('message', onMessage);

		function animate() {
			animationId = requestAnimationFrame(animate);
			const rawDelta = clock.getDelta();
			const delta = rawDelta * animationSpeedMultiplier;
			const time = clock.getElapsedTime();

			// ─── Temperature: update context and compute Tier-1 time warp ───
			actionContext.temperature = currentTemperature;
			// Tier 1: warp the time passed to actions based on temperature
			// temp=0 → 0.5× speed, temp=0.5 → 1.0×, temp=1 → 1.8×
			const tempSpeedMul = currentTemperature <= 0.5
				? 0.5 + (currentTemperature / 0.5) * 0.5
				: 1.0 + ((currentTemperature - 0.5) / 0.5) * 0.8;
			const actionTime = time * tempSpeedMul;

			updateAI(delta);
			if (isUnfocused && !mcpOverrideActive && !robotActions[currentAction].tags?.includes('movement')) {
				const isIdleish =
					aiState === 'IDLE' &&
					(robotActions[currentAction].tags?.includes('idleLike') ?? false);
				if (isIdleish) {
					unfocusedIdleTimer += delta;
					if (unfocusedIdleTimer >= unfocusedSleepDelay && !robotActions[currentAction].tags?.includes('sleep')) {
						setRobotAction('sleep');
						if (isAutoMode) {
							aiState = 'PERFORMING';
							aiTimer = 9999;
						}
					}
				} else {
					unfocusedIdleTimer = 0;
				}
			} else {
				unfocusedIdleTimer = 0;
			}
			if (
				aiState !== 'MOVING' &&
				!(robotActions[currentAction].tags?.includes('blocksAutoLookAt') ?? false) &&
				!(robotActions[currentAction].tags?.includes('sleep') ?? false)
			) {
				const facingDot = getFacingDot();
				if (facingDot < 0.5) {
					const rotDiff = normalizeRotation(0 - robot.rotation.y);
					robot.rotation.y += rotDiff * 0.05;
				}
			}
			resetTargets();
			resolveActionTransition(delta);
			const actionDef = robotActions[currentAction];
			if (actionPhase === 'pre' && actionDef.pre) {
				const progress = MathUtils.clamp(actionPhaseTimer / Math.max(actionDef.pre.duration, 0.001), 0, 1);
				actionDef.pre.apply(progress, actionTime, actionContext);
			} else if (actionPhase === 'post' && actionDef.post) {
				const progress = MathUtils.clamp(actionPhaseTimer / Math.max(actionDef.post.duration, 0.001), 0, 1);
				actionDef.post.apply(progress, actionTime, actionContext);
			} else {
				actionDef.apply(actionTime, actionContext);
			}
			actionDef.update?.(delta, actionTime, actionContext);

			// Run interaction AFTER action targets are set, so bending/grabbing/rising overrides them
			updateInteraction(delta);
			// Run ground-prop cleanup (same override pattern)
			updateCleanup(delta);

			const f = 0.1;
			const lerpV = (c: Vector3, t: Vector3) => c.lerp(t, f);
			const lerpR = (obj: Object3D, t: Vector3) => {
				obj.rotation.x = MathUtils.lerp(obj.rotation.x, t.x, f);
				obj.rotation.y = MathUtils.lerp(obj.rotation.y, t.y, f);
				obj.rotation.z = MathUtils.lerp(obj.rotation.z, t.z, f);
			};
			const lerpAngle = (current: number, target: number) => {
				let diff = target - current;
				while (diff > Math.PI) diff -= Math.PI * 2;
				while (diff < -Math.PI) diff += Math.PI * 2;
				return current + diff * f;
			};

			lerpV(bodyPivot.position, targets.body.pos);
			bodyPivot.rotation.x = MathUtils.lerp(bodyPivot.rotation.x, targets.body.rot.x, f);
			bodyPivot.rotation.y = lerpAngle(bodyPivot.rotation.y, targets.body.rot.y);
			bodyPivot.rotation.z = MathUtils.lerp(bodyPivot.rotation.z, targets.body.rot.z, f);
			lerpV(headGroup.position, targets.head.pos);
			lerpR(headGroup, targets.head.rot);
			lerpV(leftArm.position, targets.leftArm.pos);
			lerpR(leftArm, targets.leftArm.rot);
			lerpV(rightArm.position, targets.rightArm.pos);
			lerpR(rightArm, targets.rightArm.rot);
			lerpR(leftLeg, targets.leftLeg.rot);
			lerpR(rightLeg, targets.rightLeg.rot);

			robot.updateMatrixWorld(true);
			updateProps(delta, currentAction, props);
			sceneProps.update(delta);
			updateThrownProp(delta);

			if (
				!(robotActions[currentAction].tags?.includes('sleep') ?? false) &&
				!(robotActions[currentAction].tags?.includes('blocksBlink') ?? false)
			) {
				timeSinceLastBlink += delta;
				if (!isBlinking && timeSinceLastBlink > 2 + Math.random() * 3) {
					isBlinking = true;
					blinkTimer = 0;
					timeSinceLastBlink = 0;
				}
				let targetScale = 1;
				if (isBlinking) {
					blinkTimer += delta;
					targetScale = blinkTimer / blinkDuration < 0.5 ? 0.1 : 1;
					if (blinkTimer >= blinkDuration) isBlinking = false;
				}
				leftEye.scale.y = MathUtils.lerp(leftEye.scale.y, targetScale, 0.5);
				rightEye.scale.y = MathUtils.lerp(rightEye.scale.y, targetScale, 0.5);
			} else {
				const s = robotActions[currentAction].tags?.includes('sleep') ? 0.1 : 1;
				leftEye.scale.y = MathUtils.lerp(leftEye.scale.y, s, 0.1);
				rightEye.scale.y = MathUtils.lerp(rightEye.scale.y, s, 0.1);
			}


			renderer.render(scene, camera);

			// ─── Project robot head to screen space for thought bubble ───
			{
				const headWorldPos = new Vector3();
				antennaBall.getWorldPosition(headWorldPos);
				// Offset above the antenna
				headWorldPos.y += 2.0;
				const projected = headWorldPos.clone().project(camera);
				// NDC (-1..1) to fraction (0..1), clamped to keep bubbles on-screen
				const sx = Math.max(0.1, Math.min(0.9, (projected.x + 1) / 2));
				const sy = Math.max(0.05, Math.min(0.75, (1 - projected.y) / 2));
				bubbleScreenPosRef.current.x = sx;
				bubbleScreenPosRef.current.y = sy;
				const bEl = bubbleContainerRef.current;
				if (bEl) {
					bEl.style.left = `${(sx * 100).toFixed(1)}%`;
					bEl.style.top = `${(sy * 100).toFixed(1)}%`;
				}
			}
		}

		let resizeRaf = 0;
		const scheduleResize = () => {
			if (resizeRaf) return;
			resizeRaf = requestAnimationFrame(() => {
				resizeRaf = 0;
				const width = containerEl.clientWidth;
				const height = containerEl.clientHeight;
				if (width === 0 || height === 0) return;
				camera.aspect = width / height;
				camera.updateProjectionMatrix();
				renderer.setSize(width, height);

				const minDimension = Math.min(width, height);
				const scaleFactor = Math.max(0.85, Math.min(1.25, minDimension / 720));
				moveBounds.x = 10 * scaleFactor;
				moveBounds.zRange = 6 * scaleFactor;
				moveBounds.zNear = 2 + (scaleFactor - 1) * 0.6;

				peekTargets[0].set(-0.7 * moveBounds.x, -0.4, 8.5 + moveBounds.zNear * 0.5);
				peekTargets[1].set(0.7 * moveBounds.x, -0.4, 8.5 + moveBounds.zNear * 0.5);
				peekTargets[2].set(0, -1.2, 9.2 + moveBounds.zNear * 0.6);
			});
		};

		const resizeObserver = new ResizeObserver(scheduleResize);
		resizeObserver.observe(containerEl);
		window.addEventListener('resize', scheduleResize);
		scheduleResize();
		animate();
		vscode.postMessage({ command: 'READY' });

		return () => {
			window.removeEventListener('click', onWindowClick);
			window.removeEventListener('blur', updateFocusState);
			window.removeEventListener('focus', updateFocusState);
			document.removeEventListener('visibilitychange', updateFocusState);
			window.removeEventListener('resize', scheduleResize);
			resizeObserver.disconnect();
			window.removeEventListener('message', onMessage);
			cancelAnimationFrame(animationId);
			if (resizeRaf) cancelAnimationFrame(resizeRaf);
			if (clickTimeoutId) clearTimeout(clickTimeoutId);
			if (clickIntervalId) clearInterval(clickIntervalId);
			if (thrownPropMesh) { scene.remove(thrownPropMesh); thrownPropMesh = null; }
			sceneProps.clear();
			renderer.dispose();
			container.removeChild(renderer.domElement);
		};
	}, []);

	return (
		<>
			<div id="canvas-container" />
			{toasts.length > 0 && (
				<div
					ref={bubbleContainerRef}
					className="thought-bubble-container"
					style={{
						left: `${(bubbleScreenPosRef.current.x * 100).toFixed(1)}%`,
						top: `${(bubbleScreenPosRef.current.y * 100).toFixed(1)}%`
					}}
				>
					{toasts.map((toast) => (
						<div key={toast.id} className={`thought-bubble${toast.fading ? ' thought-bubble--fading' : ''}`}>
							<span className="thought-bubble__text">{toast.text}</span>
							<div className="thought-bubble__tail" />
						</div>
					))}
				</div>
			)}
		</>
	);
}
