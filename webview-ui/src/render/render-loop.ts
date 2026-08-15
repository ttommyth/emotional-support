import { MathUtils, Vector3 } from 'three';
import { robotActions } from '../robot/actions';
import { updateProps } from '../robot/actions/props';
import type { RobotSceneContext } from '../robot/scene-context';
import { updateAI } from '../robot/autopilot';
import { updateInteraction, updateCleanup, updateThrownProp } from '../robot/interaction';
import { normalizeRotation, lerpV, lerpR, lerpAngle } from './lerp';

/**
 * Render loop — one `animate` frame schedules the next and runs the whole
 * per-frame pipeline: autopilot, action transitions, interactions, cleanup,
 * prop lifecycle, blinking, rendering and thought-bubble projection.
 */
export function animate(ctx: RobotSceneContext): void {
	ctx.animationId = requestAnimationFrame(() => animate(ctx));
	const rawDelta = ctx.clock.getDelta();
	const delta = rawDelta * ctx.animationSpeedMultiplier;
	const time = ctx.clock.getElapsedTime();

	// ─── Temperature: update context and compute Tier-1 time warp ───
	ctx.actionContext.temperature = ctx.currentTemperature;
	// Tier 1: warp the time passed to actions based on temperature
	// temp=0 → 0.5× speed, temp=0.5 → 1.0×, temp=1 → 1.8×
	const tempSpeedMul = ctx.currentTemperature <= 0.5
		? 0.5 + (ctx.currentTemperature / 0.5) * 0.5
		: 1.0 + ((ctx.currentTemperature - 0.5) / 0.5) * 0.8;
	const actionTime = time * tempSpeedMul;

	updateAI(ctx, delta);
	if (ctx.isUnfocused && !ctx.mcpOverrideActive && !robotActions[ctx.currentAction].tags?.includes('movement')) {
		const isIdleish =
			ctx.aiState === 'IDLE' &&
			(robotActions[ctx.currentAction].tags?.includes('idleLike') ?? false);
		if (isIdleish) {
			ctx.unfocusedIdleTimer += delta;
			if (ctx.unfocusedIdleTimer >= ctx.unfocusedSleepDelay && !robotActions[ctx.currentAction].tags?.includes('sleep')) {
				ctx.setRobotAction('sleep');
				if (ctx.isAutoMode) {
					ctx.aiState = 'PERFORMING';
					ctx.aiTimer = 9999;
				}
			}
		} else {
			ctx.unfocusedIdleTimer = 0;
		}
	} else {
		ctx.unfocusedIdleTimer = 0;
	}
	if (
		ctx.aiState !== 'MOVING' &&
		!(robotActions[ctx.currentAction].tags?.includes('blocksAutoLookAt') ?? false) &&
		!(robotActions[ctx.currentAction].tags?.includes('sleep') ?? false)
	) {
		const facingDot = ctx.getFacingDot();
		if (facingDot < 0.5) {
			const rotDiff = normalizeRotation(0 - ctx.robot.rotation.y);
			ctx.robot.rotation.y += rotDiff * 0.05;
		}
	}
	ctx.resetTargets();
	ctx.resolveActionTransition(delta);
	const actionDef = robotActions[ctx.currentAction];
	if (ctx.actionPhase === 'pre' && actionDef.pre) {
		const progress = MathUtils.clamp(ctx.actionPhaseTimer / Math.max(actionDef.pre.duration, 0.001), 0, 1);
		actionDef.pre.apply(progress, actionTime, ctx.actionContext);
	} else if (ctx.actionPhase === 'post' && actionDef.post) {
		const progress = MathUtils.clamp(ctx.actionPhaseTimer / Math.max(actionDef.post.duration, 0.001), 0, 1);
		actionDef.post.apply(progress, actionTime, ctx.actionContext);
	} else {
		actionDef.apply(actionTime, ctx.actionContext);
	}
	actionDef.update?.(delta, actionTime, ctx.actionContext);

	// Run interaction AFTER action targets are set, so bending/grabbing/rising overrides them
	updateInteraction(ctx, delta);
	// Run ground-prop cleanup (same override pattern)
	updateCleanup(ctx, delta);

	const f = 0.1;
	lerpV(ctx.bodyPivot.position, ctx.targets.body.pos, f);
	ctx.bodyPivot.rotation.x = MathUtils.lerp(ctx.bodyPivot.rotation.x, ctx.targets.body.rot.x, f);
	ctx.bodyPivot.rotation.y = lerpAngle(ctx.bodyPivot.rotation.y, ctx.targets.body.rot.y, f);
	ctx.bodyPivot.rotation.z = MathUtils.lerp(ctx.bodyPivot.rotation.z, ctx.targets.body.rot.z, f);
	lerpV(ctx.headGroup.position, ctx.targets.head.pos, f);
	lerpR(ctx.headGroup, ctx.targets.head.rot, f);
	lerpV(ctx.leftArm.position, ctx.targets.leftArm.pos, f);
	lerpR(ctx.leftArm, ctx.targets.leftArm.rot, f);
	lerpV(ctx.rightArm.position, ctx.targets.rightArm.pos, f);
	lerpR(ctx.rightArm, ctx.targets.rightArm.rot, f);
	lerpR(ctx.leftLeg, ctx.targets.leftLeg.rot, f);
	lerpR(ctx.rightLeg, ctx.targets.rightLeg.rot, f);

	ctx.robot.updateMatrixWorld(true);
	updateProps(delta, ctx.currentAction, ctx.props);
	ctx.sceneProps.update(delta);
	updateThrownProp(ctx, delta);

	if (
		!(robotActions[ctx.currentAction].tags?.includes('sleep') ?? false) &&
		!(robotActions[ctx.currentAction].tags?.includes('blocksBlink') ?? false)
	) {
		ctx.timeSinceLastBlink += delta;
		if (!ctx.isBlinking && ctx.timeSinceLastBlink > 2 + Math.random() * 3) {
			ctx.isBlinking = true;
			ctx.blinkTimer = 0;
			ctx.timeSinceLastBlink = 0;
		}
		let targetScale = 1;
		if (ctx.isBlinking) {
			ctx.blinkTimer += delta;
			targetScale = ctx.blinkTimer / ctx.blinkDuration < 0.5 ? 0.1 : 1;
			if (ctx.blinkTimer >= ctx.blinkDuration) ctx.isBlinking = false;
		}
		ctx.leftEye.scale.y = MathUtils.lerp(ctx.leftEye.scale.y, targetScale, 0.5);
		ctx.rightEye.scale.y = MathUtils.lerp(ctx.rightEye.scale.y, targetScale, 0.5);
	} else {
		const s = robotActions[ctx.currentAction].tags?.includes('sleep') ? 0.1 : 1;
		ctx.leftEye.scale.y = MathUtils.lerp(ctx.leftEye.scale.y, s, 0.1);
		ctx.rightEye.scale.y = MathUtils.lerp(ctx.rightEye.scale.y, s, 0.1);
	}

	ctx.renderer.render(ctx.scene, ctx.camera);

	// ─── Project to screen space (bubble + object anchors) ───
	{
		// Object anchor: the actual object the robot is working with — its prop
		// (the book while reading, the laptop while editing). Track the prop's
		// mesh so the label follows it even while it's being dropped/thrown,
		// not just while held. Falls back to the robot's head when no prop is out.
		const objPos = new Vector3();
		const prop = ctx.props.get(ctx.currentAction);
		if (prop && prop.state !== 'hidden') {
			prop.mesh.getWorldPosition(objPos);
		} else {
			ctx.antennaBall.getWorldPosition(objPos);
		}
		const objProjected = objPos.clone().project(ctx.camera);
		const ox = Math.max(0.1, Math.min(0.9, (objProjected.x + 1) / 2));
		const oy = Math.max(0.05, Math.min(0.85, (1 - objProjected.y) / 2));
		ctx.objectScreenPosRef.current.x = ox;
		ctx.objectScreenPosRef.current.y = oy;

		// Bubble anchor: robot head, offset above the antenna for the thought bubble.
		const headWorldPos = new Vector3();
		ctx.antennaBall.getWorldPosition(headWorldPos);
		headWorldPos.y += 2.0;
		const projected = headWorldPos.clone().project(ctx.camera);
		// NDC (-1..1) to fraction (0..1), clamped to keep bubbles on-screen
		const sx = Math.max(0.1, Math.min(0.9, (projected.x + 1) / 2));
		const sy = Math.max(0.05, Math.min(0.75, (1 - projected.y) / 2));
		ctx.bubbleScreenPosRef.current.x = sx;
		ctx.bubbleScreenPosRef.current.y = sy;
		const bEl = ctx.bubbleContainerRef.current;
		if (bEl) {
			bEl.style.left = `${(sx * 100).toFixed(1)}%`;
			bEl.style.top = `${(sy * 100).toFixed(1)}%`;
		}

		// Filename callout: position it every frame so it tracks the object it
		// points at. The label sits at the object's top-left / top-right corner
		// (whichever side has room) with a diagonal leader line to the object.
		const cEl = ctx.calloutContainerRef.current;
		if (cEl) {
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const px = ox * vw;
			const py = oy * vh;
			const w = cEl.offsetWidth;
			const h = cEl.offsetHeight;
			const HG = 8; // horizontal gap from the object
			const VG = 6; // vertical gap from the object

			const side: 'left' | 'right' | 'center' =
				px + HG + w <= vw ? 'right' : px - HG - w >= 0 ? 'left' : 'center';

			let left: number;
			let top: number;
			let cornerX: number;
			let cornerY: number;
			if (side === 'right') {
				left = px + HG;
				top = py - h - VG;
				cornerX = left;
				cornerY = top + h;
			} else if (side === 'left') {
				left = px - HG - w;
				top = py - h - VG;
				cornerX = left + w;
				cornerY = top + h;
			} else {
				left = Math.max(0, Math.min(px - w / 2, vw - w));
				top = py - h - VG;
				cornerX = px;
				cornerY = py - h;
			}

			// Flip below the object when the label would clip the top edge.
			if (top < 0) {
				top = py + VG;
				cornerX = side === 'right' ? px + HG : side === 'left' ? px - HG : px;
				cornerY = top;
			}
			left = Math.max(0, Math.min(left, vw - w));

			cEl.style.left = `${Math.round(left)}px`;
			cEl.style.top = `${Math.round(top)}px`;
			cEl.style.visibility = 'visible';

			// Diagonal leader line from the label corner to the object point.
			const line = cEl.querySelector('.activity-callout__line') as HTMLElement | null;
			if (line) {
				const dx = px - cornerX;
				const dy = py - cornerY;
				const len = Math.max(4, Math.hypot(dx, dy));
				const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
				line.style.left = `${cornerX - left}px`;
				line.style.top = `${cornerY - top}px`;
				line.style.width = `${Math.round(len)}px`;
				line.style.transform = `rotate(${angle.toFixed(1)}deg)`;
			}
		}
	}
}

/** Kick off the render loop. The loop reschedules itself via rAF. */
export function startRenderLoop(ctx: RobotSceneContext): void {
	animate(ctx);
}
