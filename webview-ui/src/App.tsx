import { useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry';
import { robotActions } from './robot/actions';
import { getEyeColor } from './robot/actions/eyes';
import { createRobotProps, updateProps } from './robot/actions/props';
import type { RobotActionContext, RobotActionName, RobotTargets } from './robot/types';

declare const acquireVsCodeApi: (() => { postMessage: (message: unknown) => void }) | undefined;

export default function App() {
	useEffect(() => {
		const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : { postMessage: () => undefined };
		const container = document.getElementById('canvas-container') as HTMLDivElement | null;
		if (!container) {
			return;
		}
		const containerEl = container;

		const scene = new THREE.Scene();
		const computedStyles = getComputedStyle(document.body);
		const themeBackground = computedStyles.getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';
		const backgroundColor = new THREE.Color(themeBackground);
		scene.background = backgroundColor;
		scene.fog = new THREE.Fog(backgroundColor, 14, 55);

		const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
		camera.position.set(0, 3.6, 18);

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		containerEl.appendChild(renderer.domElement);

		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableRotate = false;
		controls.enableZoom = false;
		controls.enablePan = false;
		controls.target.set(0, 2, 0);
		controls.update();

		const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
		scene.add(ambientLight);

		const dirLight = new THREE.DirectionalLight(0xffffff, 1);
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

		const planeGeometry = new THREE.PlaneGeometry(200, 200);
		const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.1, color: 0x000000 });
		const plane = new THREE.Mesh(planeGeometry, planeMaterial);
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
			eyePurple: 0xa29bfe
		};

		const matWhite = new THREE.MeshLambertMaterial({ color: colors.white });
		const matOrange = new THREE.MeshLambertMaterial({ color: colors.orange });
		const matDark = new THREE.MeshLambertMaterial({ color: colors.darkGray });
		const matMetal = new THREE.MeshLambertMaterial({ color: colors.metal });
		const matEye = new THREE.MeshBasicMaterial({ color: colors.eyeCyan });

		const robot = new THREE.Group();
		robot.position.set(0, -0.6, 2.5);
		scene.add(robot);
		const bodyPivot = new THREE.Group();
		robot.add(bodyPivot);

		const torso = new THREE.Mesh(new RoundedBoxGeometry(3.5, 4.5, 2.5, 4, 0.5), matWhite);
		torso.castShadow = true;
		bodyPivot.add(torso);

		const chestPlate = new THREE.Mesh(new RoundedBoxGeometry(2, 1.4, 0.2, 4, 0.1), matOrange);
		chestPlate.position.set(0, 1, 1.3);
		chestPlate.castShadow = true;
		bodyPivot.add(chestPlate);

		const headGroup = new THREE.Group();
		headGroup.position.set(0, 3.5, 0);
		bodyPivot.add(headGroup);

		const headMesh = new THREE.Mesh(new RoundedBoxGeometry(5, 4, 3.5, 4, 0.2), matWhite);
		headMesh.castShadow = true;
		headGroup.add(headMesh);

		const visor = new THREE.Mesh(new RoundedBoxGeometry(4, 2.2, 0.5, 4, 0.1), matDark);
		visor.position.set(0, 0, 1.8);
		headGroup.add(visor);

		const leftEye = new THREE.Mesh(new THREE.CircleGeometry(0.4, 32), matEye);
		leftEye.position.set(-1, 0, 2.1);
		headGroup.add(leftEye);
		const rightEye = leftEye.clone();
		rightEye.position.set(1, 0, 2.1);
		headGroup.add(rightEye);

		const earGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.5, 32);
		const leftEar = new THREE.Mesh(earGeo, matOrange);
		leftEar.rotation.z = Math.PI / 2;
		leftEar.position.set(-2.8, 0, 0);
		headGroup.add(leftEar);
		const rightEar = leftEar.clone();
		rightEar.position.set(2.8, 0, 0);
		headGroup.add(rightEar);

		const antennaStem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 1, 16), matMetal);
		antennaStem.position.set(0, 2.5, 0);
		headGroup.add(antennaStem);
		const antennaBall = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), matOrange);
		antennaBall.position.set(0, 3, 0);
		headGroup.add(antennaBall);

		function createLimb(x: number, y: number, isArm = false) {
			const group = new THREE.Group();
			group.position.set(x, y, 0);
			const limbMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 2, 4, 8), isArm ? matMetal : matDark);
			limbMesh.position.y = -1;
			limbMesh.castShadow = true;
			group.add(limbMesh);
			if (isArm) {
				const hand = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), matWhite);
				hand.position.y = -2.2;
				hand.castShadow = true;
				group.add(hand);
			} else {
				const foot = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.8, 1.8, 4, 0.2), matWhite);
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

		const props = createRobotProps({ scene, bodyPivot });

		const targets: RobotTargets = {
			body: { pos: new THREE.Vector3(), rot: new THREE.Vector3() },
			head: { pos: new THREE.Vector3(0, 3.5, 0), rot: new THREE.Vector3() },
			leftArm: { pos: new THREE.Vector3(-2.2, 1.5, 0), rot: new THREE.Vector3() },
			rightArm: { pos: new THREE.Vector3(2.2, 1.5, 0), rot: new THREE.Vector3() },
			leftLeg: { rot: new THREE.Vector3() },
			rightLeg: { rot: new THREE.Vector3() }
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
		let isAutoMode = true;
		let aiState = 'IDLE';
		let aiTimer = 0;
		const moveTarget = new THREE.Vector3();
		const robotSpeed = 5;
		const moveBounds = { x: 10, zNear: 2, zRange: 6 };
		const peekTargets = [
			new THREE.Vector3(-5.2, -0.4, 8.5),
			new THREE.Vector3(5.2, -0.4, 8.5),
			new THREE.Vector3(0, -1.2, 9.2)
		];

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
			currentAction = action;
			if (btn) {
				document.querySelectorAll('.btn').forEach((b) => b.classList.remove('active'));
				btn.classList.add('active');
			}
			setEyeColor(action);
		}

		function setEyeColor(action: RobotActionName) {
			matEye.color.setHex(getEyeColor(action, colors));
		}

		function updateAI(delta: number) {
			if (currentAction === 'knocked') {
				let rotDiff = 0 - robot.rotation.y;
				while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
				while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
				robot.rotation.y += rotDiff * 0.1;
				return;
			}

			if (!isAutoMode) return;

			aiTimer -= delta;

			if (aiState === 'IDLE') {
				if (aiTimer <= 0) {
					const r = Math.random();
					if (r < 0.55) {
						aiState = 'MOVING';
						moveTarget.set(
							(Math.random() - 0.5) * moveBounds.x,
							0,
							(Math.random() - 0.5) * moveBounds.zRange + moveBounds.zNear
						);
						currentAction = 'walk';
					} else if (r < 0.8) {
						const acts: RobotActionName[] = ['thinking', 'coding', 'reading', 'success', 'idle'];
						currentAction = acts[Math.floor(Math.random() * acts.length)];
						aiState = 'PERFORMING';
						aiTimer = 3 + Math.random() * 4;
						setEyeColor(currentAction);
					} else {
						aiState = 'MOVING';
						const peekTarget = peekTargets[Math.floor(Math.random() * peekTargets.length)];
						moveTarget.copy(peekTarget);
						currentAction = 'walk';
					}
				}
			} else if (aiState === 'MOVING') {
				const direction = new THREE.Vector3().subVectors(moveTarget, robot.position);
				const dist = direction.length();

				if (dist < 0.2) {
					robot.position.copy(moveTarget);
					if (robot.position.z > 8) {
						aiState = 'PERFORMING';
						currentAction = 'wave';
						aiTimer = 3;
						const targetRot = 0;
						let rotDiff = targetRot - robot.rotation.y;
						while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
						while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
						robot.rotation.y = targetRot;
					} else {
						aiState = 'IDLE';
						currentAction = 'idle';
						aiTimer = 1;
					}
				} else {
					direction.normalize();
					robot.position.addScaledVector(direction, robotSpeed * delta);
					const targetRot = Math.atan2(direction.x, direction.z);
					let rotDiff = targetRot - robot.rotation.y;
					while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
					while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
					robot.rotation.y += rotDiff * 0.1;
				}
			} else if (aiState === 'PERFORMING') {
				if (aiTimer <= 0) {
					aiState = 'IDLE';
					currentAction = 'idle';
					aiTimer = 0.5;
				}
			}
		}

		const actionContext: RobotActionContext = {
			targets,
			props,
			headGroup,
			robot
		};

		const clock = new THREE.Clock();
		let isBlinking = false;
		let blinkTimer = 0;
		let timeSinceLastBlink = 0;
		const blinkDuration = 0.15;
		let animationId = 0;

		const onWindowClick = (event: MouseEvent) => {
			createRipple(event.clientX, event.clientY);

			currentAction = 'knocked';
			setEyeColor('knocked');

			setTimeout(() => {
				if (currentAction === 'knocked') {
					currentAction = 'idle';
					setEyeColor('idle');
					if (isAutoMode) {
						aiState = 'IDLE';
						aiTimer = 0;
					}
				}
			}, 2000);
		};

		window.addEventListener('click', onWindowClick);

		const onMessage = (event: MessageEvent) => {
			const message = event.data;
			if (message?.command === 'SET_MOOD' && typeof message?.mood === 'string' && isRobotAction(message.mood)) {
				setRobotAction(message.mood);
			}
		};
		window.addEventListener('message', onMessage);

		function animate() {
			animationId = requestAnimationFrame(animate);
			const delta = clock.getDelta();
			const time = clock.getElapsedTime();

			updateAI(delta);
			resetTargets();
			robotActions[currentAction].apply(time, actionContext);
			robotActions[currentAction].update?.(delta, time, actionContext);

			const f = 0.1;
			const lerpV = (c: THREE.Vector3, t: THREE.Vector3) => c.lerp(t, f);
			const lerpR = (obj: THREE.Object3D, t: THREE.Vector3) => {
				obj.rotation.x = THREE.MathUtils.lerp(obj.rotation.x, t.x, f);
				obj.rotation.y = THREE.MathUtils.lerp(obj.rotation.y, t.y, f);
				obj.rotation.z = THREE.MathUtils.lerp(obj.rotation.z, t.z, f);
			};

			lerpV(bodyPivot.position, targets.body.pos);
			lerpR(bodyPivot, targets.body.rot);
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

			if (currentAction !== 'sleep' && currentAction !== 'error') {
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
				leftEye.scale.y = THREE.MathUtils.lerp(leftEye.scale.y, targetScale, 0.5);
				rightEye.scale.y = THREE.MathUtils.lerp(rightEye.scale.y, targetScale, 0.5);
			} else {
				const s = currentAction === 'sleep' ? 0.1 : 1;
				leftEye.scale.y = THREE.MathUtils.lerp(leftEye.scale.y, s, 0.1);
				rightEye.scale.y = THREE.MathUtils.lerp(rightEye.scale.y, s, 0.1);
			}


			controls.update();
			renderer.render(scene, camera);
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

				peekTargets[0].set(-0.52 * moveBounds.x, -0.4, 8.5 + moveBounds.zNear * 0.5);
				peekTargets[1].set(0.52 * moveBounds.x, -0.4, 8.5 + moveBounds.zNear * 0.5);
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
			window.removeEventListener('resize', scheduleResize);
			resizeObserver.disconnect();
			window.removeEventListener('message', onMessage);
			cancelAnimationFrame(animationId);
			if (resizeRaf) cancelAnimationFrame(resizeRaf);
			renderer.dispose();
			container.removeChild(renderer.domElement);
		};
	}, []);

	return (
		<>
			<div id="canvas-container" />
		</>
	);
}
