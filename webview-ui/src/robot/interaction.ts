import { Vector3 } from 'three';
import { buildScenePropMesh } from './scene-props';
import { SCENE_PROP_ACTION_MAP, GROUND_Y } from './types';
import type { FinishBehavior, ScenePropType } from './types';
import type { RobotSceneContext } from './scene-context';

/**
 * Interaction subsystem — scene-prop pickup state machine, ground-prop
 * cleanup state machine, and the thrown-prop projectile.
 *
 * All functions operate on a `RobotSceneContext` (implemented by the
 * `RobotScene` class) instead of capturing a giant closure.
 */

export function launchThrownProp(ctx: RobotSceneContext, type: ScenePropType, start: Vector3, end: Vector3, peak: number, duration: number, spin: number) {
	if (ctx.thrownPropMesh) {
		ctx.scene.remove(ctx.thrownPropMesh);
	}
	ctx.thrownPropMesh = buildScenePropMesh(type);
	ctx.thrownPropMesh.scale.set(0.7, 0.7, 0.7);
	ctx.scene.add(ctx.thrownPropMesh);
	ctx.thrownPropStart.copy(start);
	ctx.thrownPropEnd.copy(end);
	ctx.thrownPropPeak = peak;
	ctx.thrownPropDuration = duration;
	ctx.thrownPropTimer = 0;
	ctx.thrownPropSpin = spin;
}

export function updateThrownProp(ctx: RobotSceneContext, delta: number) {
	if (!ctx.thrownPropMesh) return;
	ctx.thrownPropTimer += delta;
	const p = Math.min(1, ctx.thrownPropTimer / ctx.thrownPropDuration);
	// Parabolic arc
	const x = ctx.thrownPropStart.x + (ctx.thrownPropEnd.x - ctx.thrownPropStart.x) * p;
	const z = ctx.thrownPropStart.z + (ctx.thrownPropEnd.z - ctx.thrownPropStart.z) * p;
	const baseY = ctx.thrownPropStart.y + (ctx.thrownPropEnd.y - ctx.thrownPropStart.y) * p;
	const arcY = 4 * ctx.thrownPropPeak * p * (1 - p);
	ctx.thrownPropMesh.position.set(x, baseY + arcY, z);
	ctx.thrownPropMesh.rotation.x += ctx.thrownPropSpin * delta;
	ctx.thrownPropMesh.rotation.z += ctx.thrownPropSpin * 0.7 * delta;
	if (p >= 1) {
		// Shrink and remove
		ctx.thrownPropMesh.scale.multiplyScalar(0.8);
		if (ctx.thrownPropMesh.scale.x < 0.05) {
			ctx.scene.remove(ctx.thrownPropMesh);
			ctx.thrownPropMesh = null;
		}
	}
}

export function startInteraction(ctx: RobotSceneContext, propId: string, durationAfterPickup: number, finishBehavior: FinishBehavior = 'none') {
	const prop = ctx.sceneProps.getById(propId);
	if (!prop) return;
	let targetAction = SCENE_PROP_ACTION_MAP[prop.type];
	if (!targetAction) {
		// decorations (and any unmapped type) still get inspected
		targetAction = 'inspect';
	}
	prop.state = 'targeted';
	ctx.interaction = {
		phase: 'walking',
		propId,
		propType: prop.type,
		targetAction,
		timer: 0,
		durationAfterPickup,
		finishBehavior
	};
	// Override AI and start walking toward prop — stop just behind it
	ctx.mcpOverrideActive = true;
	ctx.aiState = 'MOVING';
	ctx.moveTarget.set(prop.worldX, 0, prop.worldZ + 0.3);
	ctx.setRobotAction('walk');
}

export function updateInteraction(ctx: RobotSceneContext, delta: number) {
	if (!ctx.interaction) return;
	const prop = ctx.sceneProps.getById(ctx.interaction.propId);

	if (ctx.interaction.phase === 'walking') {
		// Check if robot has arrived near the target
		const dx = ctx.moveTarget.x - ctx.robot.position.x;
		const dz = ctx.moveTarget.z - ctx.robot.position.z;
		const dist = Math.sqrt(dx * dx + dz * dz);
		if (dist < 0.5) {
			// Arrived — face toward the prop then bend
			if (prop) {
				const toPropX = prop.worldX - ctx.robot.position.x;
				const toPropZ = prop.worldZ - ctx.robot.position.z;
				ctx.robot.rotation.y = Math.atan2(toPropX, toPropZ);
			}
			ctx.interaction.phase = 'bending';
			ctx.interaction.timer = 0;
			ctx.currentSpeed = 0;
			ctx.aiState = 'IDLE';
			ctx.setRobotAction('idle');
		}
		return;
	}

	ctx.interaction.timer += delta;

	if (ctx.interaction.phase === 'bending') {
		// Bend body forward and down
		const p = Math.min(1, ctx.interaction.timer / ctx.BEND_DURATION);
		const eased = p * p * (3 - 2 * p); // smoothstep
		ctx.targets.body.pos.set(0, -1.5 * eased, 0.5 * eased);
		ctx.targets.body.rot.set(0.6 * eased, 0, 0);
		ctx.targets.leftArm.rot.set(-0.8 * eased, 0, 0.3 * eased);
		ctx.targets.rightArm.rot.set(-0.8 * eased, 0, -0.3 * eased);
		if (p >= 1) {
			ctx.interaction.phase = 'grabbing';
			ctx.interaction.timer = 0;
			if (prop) {
				prop.state = 'grabbed';
				// Hide ground mesh immediately so it doesn't linger
				prop.mesh.visible = false;
			}
		}
		return;
	}

	if (ctx.interaction.phase === 'grabbing') {
		// Hold bent pose briefly while prop shrinks
		ctx.targets.body.pos.set(0, -1.5, 0.5);
		ctx.targets.body.rot.set(0.6, 0, 0);
		ctx.targets.leftArm.rot.set(-0.8, 0, 0.3);
		ctx.targets.rightArm.rot.set(-0.8, 0, -0.3);
		if (ctx.interaction.timer >= ctx.GRAB_DURATION) {
			ctx.interaction.phase = 'rising';
			ctx.interaction.timer = 0;
		}
		return;
	}

	if (ctx.interaction.phase === 'rising') {
		// Rise back to standing
		const p = Math.min(1, ctx.interaction.timer / ctx.RISE_DURATION);
		const eased = p * p * (3 - 2 * p);
		ctx.targets.body.pos.set(0, -1.5 * (1 - eased), 0.5 * (1 - eased));
		ctx.targets.body.rot.set(0.6 * (1 - eased), 0, 0);
		ctx.targets.leftArm.rot.set(-0.8 * (1 - eased), 0, 0.3 * (1 - eased));
		ctx.targets.rightArm.rot.set(-0.8 * (1 - eased), 0, -0.3 * (1 - eased));
		if (p >= 1) {
			// Transition to performing the action
			const targetAction = ctx.interaction.targetAction;
			const duration = ctx.interaction.durationAfterPickup;
			ctx.interaction.phase = 'performing';
			ctx.interaction.timer = 0;
			ctx.setRobotAction(targetAction);
			ctx.mcpOverrideActive = true;
			ctx.mcpRequestedAction = targetAction;
			ctx.mcpDurationTimer = duration > 0 ? duration : 0;
			if (ctx.mcpTimeoutId) {
				window.clearTimeout(ctx.mcpTimeoutId);
				ctx.mcpTimeoutId = 0;
			}
			if (ctx.mcpDurationTimer > 0) {
				ctx.mcpTimeoutId = window.setTimeout(() => {
					ctx.mcpDurationTimer = 0;
				}, ctx.mcpDurationTimer * 1000);
			}
		}
		return;
	}

	if (ctx.interaction.phase === 'performing') {
		// Wait for MCP duration to expire, then trigger finish behavior
		if (ctx.mcpDurationTimer <= 0) {
			const finish = ctx.interaction.finishBehavior;
			if (finish === 'throw_away') {
				ctx.interaction.phase = 'throwing';
				ctx.interaction.timer = 0;
				ctx.setRobotAction('idle');
			} else if (finish === 'throw_up') {
				ctx.interaction.phase = 'tossing';
				ctx.interaction.timer = 0;
				ctx.setRobotAction('idle');
			} else if (finish === 'put_down') {
				ctx.interaction.phase = 'putting_down';
				ctx.interaction.timer = 0;
				ctx.setRobotAction('idle');
			} else {
				// No finish behavior — just end
				ctx.interaction = null;
				ctx.mcpOverrideActive = false;
				ctx.setRobotAction('idle');
				ctx.aiState = 'IDLE';
				ctx.aiTimer = 0.5;
			}
		}
		return;
	}

	if (ctx.interaction.phase === 'throwing') {
		// Angry throw animation: wind up then hurl forward
		const p = Math.min(1, ctx.interaction.timer / ctx.THROW_DURATION);
		if (p < 0.4) {
			// Wind up — pull arm back
			const wp = p / 0.4;
			ctx.targets.body.rot.set(0, -0.3 * wp, 0);
			ctx.targets.rightArm.rot.set(-1.5 * wp, 0, -0.5 * wp);
			ctx.targets.leftArm.rot.set(0.3 * wp, 0, 0.3 * wp);
		} else {
			// Throw forward
			const tp = (p - 0.4) / 0.6;
			const te = tp * tp * (3 - 2 * tp);
			ctx.targets.body.rot.set(0.2 * te, 0.4 * te, 0);
			ctx.targets.rightArm.rot.set(1.2 * te - 1.5 * (1 - te), 0, -0.3);
			ctx.targets.leftArm.rot.set(-0.2, 0, 0.3);
			if (tp > 0.1 && !ctx.thrownPropMesh) {
				// Launch the prop
				const startPos = new Vector3();
				ctx.robot.getWorldPosition(startPos);
				startPos.y += 2;
				const throwDir = new Vector3(0, 0, 1).applyAxisAngle(new Vector3(0, 1, 0), ctx.robot.rotation.y);
				const endPos = startPos.clone().addScaledVector(throwDir, 8);
				endPos.y = GROUND_Y;
				launchThrownProp(ctx, ctx.interaction.propType, startPos, endPos, 2, 0.8, 12);
			}
		}
		if (p >= 1) {
			ctx.interaction = null;
			ctx.mcpOverrideActive = false;
			ctx.aiState = 'IDLE';
			ctx.aiTimer = 0.5;
		}
		return;
	}

	if (ctx.interaction.phase === 'tossing') {
		// Celebratory toss — throw prop straight up with joy
		const p = Math.min(1, ctx.interaction.timer / ctx.TOSS_DURATION);
		if (p < 0.3) {
			// Crouch down a bit then spring up
			const wp = p / 0.3;
			ctx.targets.body.pos.set(0, -0.5 * wp, 0);
			ctx.targets.leftArm.rot.set(-0.5 * wp, 0, 0.3 * wp);
			ctx.targets.rightArm.rot.set(-0.5 * wp, 0, -0.3 * wp);
		} else {
			// Spring up, arms go high
			const tp = (p - 0.3) / 0.7;
			const te = tp * tp * (3 - 2 * tp);
			ctx.targets.body.pos.set(0, 0.5 * te, 0);
			ctx.targets.leftArm.rot.set(-2.5 * te, 0, 0.5 * te);
			ctx.targets.rightArm.rot.set(-2.5 * te, 0, -0.5 * te);
			if (tp > 0.05 && !ctx.thrownPropMesh) {
				const startPos = new Vector3();
				ctx.robot.getWorldPosition(startPos);
				startPos.y += 4;
				const endPos = startPos.clone();
				endPos.y += 12;
				launchThrownProp(ctx, ctx.interaction.propType, startPos, endPos, 6, 1.5, 5);
			}
		}
		if (p >= 1) {
			ctx.interaction = null;
			ctx.mcpOverrideActive = false;
			ctx.setRobotAction('success');
			ctx.mcpOverrideActive = true;
			ctx.mcpRequestedAction = 'success';
			ctx.mcpDurationTimer = 2;
			if (ctx.mcpTimeoutId) { window.clearTimeout(ctx.mcpTimeoutId); ctx.mcpTimeoutId = 0; }
			ctx.mcpTimeoutId = window.setTimeout(() => { ctx.mcpDurationTimer = 0; }, 2000);
		}
		return;
	}

	if (ctx.interaction.phase === 'putting_down') {
		// Gently place prop back on ground
		const p = Math.min(1, ctx.interaction.timer / ctx.PUT_DOWN_DURATION);
		if (p < 0.5) {
			// Bend down
			const bp = p / 0.5;
			const be = bp * bp * (3 - 2 * bp);
			ctx.targets.body.pos.set(0, -1.2 * be, 0.4 * be);
			ctx.targets.body.rot.set(0.5 * be, 0, 0);
			ctx.targets.leftArm.rot.set(-0.6 * be, 0, 0.2 * be);
			ctx.targets.rightArm.rot.set(-0.6 * be, 0, -0.2 * be);
		} else {
			// Rise back up (prop left on ground)
			const rp = (p - 0.5) / 0.5;
			const re = rp * rp * (3 - 2 * rp);
			ctx.targets.body.pos.set(0, -1.2 * (1 - re), 0.4 * (1 - re));
			ctx.targets.body.rot.set(0.5 * (1 - re), 0, 0);
			ctx.targets.leftArm.rot.set(-0.6 * (1 - re), 0, 0.2 * (1 - re));
			ctx.targets.rightArm.rot.set(-0.6 * (1 - re), 0, -0.2 * (1 - re));
			if (rp > 0.1 && !ctx.thrownPropMesh) {
				// Place a new prop on the ground at robot's position
				const placeX = ctx.robot.position.x + Math.sin(ctx.robot.rotation.y) * 1.5;
				const placeZ = ctx.robot.position.z + Math.cos(ctx.robot.rotation.y) * 1.5;
				ctx.sceneProps.add(`placed-${Date.now()}`, ctx.interaction.propType, placeX, placeZ, false);
			}
		}
		if (p >= 1) {
			ctx.interaction = null;
			ctx.mcpOverrideActive = false;
			ctx.setRobotAction('idle');
			ctx.aiState = 'IDLE';
			ctx.aiTimer = 0.5;
		}
		return;
	}
}

/**
 * Start cleaning up a ground prop (action prop that fell).
 * The robot walks to it, bends down, picks it up, and does
 * a little satisfied reaction.
 */
export function startCleanup(ctx: RobotSceneContext, propName: string) {
	const propState = ctx.props.get(propName);
	if (!propState || propState.state !== 'ground') return;
	ctx.cleanup = { phase: 'walking', propName, timer: 0 };
	ctx.mcpOverrideActive = true; // ensure walking works even with autopilot off
	ctx.aiState = 'MOVING';
	ctx.moveTarget.set(propState.mesh.position.x, 0, propState.mesh.position.z + 0.5);
	ctx.setRobotAction('walk');
}

/**
 * Per-frame update for the ground-prop cleanup state machine.
 */
export function updateCleanup(ctx: RobotSceneContext, delta: number) {
	if (!ctx.cleanup) return;
	const propState = ctx.props.get(ctx.cleanup.propName);

	// If the prop vanished (auto-faded) while we were going there, abort
	if (!propState || propState.state !== 'ground') {
		ctx.cleanup = null;
		ctx.mcpOverrideActive = false;
		ctx.setRobotAction('idle');
		ctx.aiState = 'IDLE';
		ctx.aiTimer = 0.5;
		return;
	}

	if (ctx.cleanup.phase === 'walking') {
		const dx = ctx.moveTarget.x - ctx.robot.position.x;
		const dz = ctx.moveTarget.z - ctx.robot.position.z;
		const dist = Math.sqrt(dx * dx + dz * dz);
		if (dist < 0.5) {
			// Face the prop
			const toPropX = propState.mesh.position.x - ctx.robot.position.x;
			const toPropZ = propState.mesh.position.z - ctx.robot.position.z;
			ctx.robot.rotation.y = Math.atan2(toPropX, toPropZ);
			ctx.cleanup.phase = 'bending';
			ctx.cleanup.timer = 0;
			ctx.currentSpeed = 0;
			ctx.aiState = 'IDLE';
			ctx.setRobotAction('tidyup');
		}
		return;
	}

	ctx.cleanup.timer += delta;

	if (ctx.cleanup.phase === 'bending') {
		// Bend forward (same motion as scene-prop interaction)
		const p = Math.min(1, ctx.cleanup.timer / ctx.BEND_DURATION);
		const eased = p * p * (3 - 2 * p);
		ctx.targets.body.pos.set(0, -1.5 * eased, 0.5 * eased);
		ctx.targets.body.rot.set(0.6 * eased, 0, 0);
		ctx.targets.leftArm.rot.set(-0.8 * eased, 0, 0.3 * eased);
		ctx.targets.rightArm.rot.set(-0.8 * eased, 0, -0.3 * eased);
		if (p >= 1) {
			ctx.cleanup.phase = 'grabbing';
			ctx.cleanup.timer = 0;
			// Immediately hide the ground prop
			propState.state = 'hidden';
			propState.groundTimer = 0;
			propState.mesh.visible = false;
			propState.mesh.scale.set(0, 0, 0);
		}
		return;
	}

	if (ctx.cleanup.phase === 'grabbing') {
		// Hold bent pose briefly
		ctx.targets.body.pos.set(0, -1.5, 0.5);
		ctx.targets.body.rot.set(0.6, 0, 0);
		ctx.targets.leftArm.rot.set(-0.8, 0, 0.3);
		ctx.targets.rightArm.rot.set(-0.8, 0, -0.3);
		if (ctx.cleanup.timer >= ctx.GRAB_DURATION) {
			ctx.cleanup.phase = 'rising';
			ctx.cleanup.timer = 0;
		}
		return;
	}

	if (ctx.cleanup.phase === 'rising') {
		// Stand back up
		const p = Math.min(1, ctx.cleanup.timer / ctx.RISE_DURATION);
		const eased = p * p * (3 - 2 * p);
		ctx.targets.body.pos.set(0, -1.5 * (1 - eased), 0.5 * (1 - eased));
		ctx.targets.body.rot.set(0.6 * (1 - eased), 0, 0);
		ctx.targets.leftArm.rot.set(-0.8 * (1 - eased), 0, 0.3 * (1 - eased));
		ctx.targets.rightArm.rot.set(-0.8 * (1 - eased), 0, -0.3 * (1 - eased));
		if (p >= 1) {
			ctx.cleanup.phase = 'celebrate';
			ctx.cleanup.timer = 0;
			ctx.setRobotAction('success');
		}
		return;
	}

	if (ctx.cleanup.phase === 'celebrate') {
		// Brief satisfied reaction then done
		if (ctx.cleanup.timer >= 1.5) {
			ctx.cleanup = null;
			ctx.mcpOverrideActive = false;
			ctx.setRobotAction('idle');
			ctx.aiState = 'IDLE';
			ctx.aiTimer = 1 + Math.random() * 2;
		}
	}
}
