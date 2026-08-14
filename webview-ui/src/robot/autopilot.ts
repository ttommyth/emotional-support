import { MathUtils, Vector3 } from 'three';
import { getActionsByTag, robotActions } from './actions';
import type { RobotActionName } from './types';
import type { RobotSceneContext } from './scene-context';
import { startInteraction, startCleanup } from './interaction';

/**
 * Autopilot AI — the `updateAI` idle/move/perform state machine.
 *
 * Operates on a `RobotSceneContext` (implemented by the `RobotScene` class)
 * so it can live in its own module instead of inside a giant closure.
 */
export function updateAI(ctx: RobotSceneContext, delta: number) {
	if (ctx.mcpOverrideActive) {
		if (ctx.mcpDurationTimer > 0) {
			ctx.mcpDurationTimer = Math.max(0, ctx.mcpDurationTimer - delta);
		}
		if (ctx.mcpDurationTimer <= 0 && ctx.mcpRequestedAction && ctx.mcpRequestedAction !== 'idle') {
			ctx.mcpOverrideActive = false;
			ctx.mcpRequestedAction = 'idle';
			ctx.setRobotAction('idle');
			// Give autopilot a cooldown so it doesn't immediately pick a new action
			ctx.aiState = 'IDLE';
			ctx.aiTimer = 2 + Math.random() * 2;
		}
		if (!(robotActions[ctx.currentAction].tags?.includes('movement') ?? false) || ctx.aiState !== 'MOVING') {
			return;
		}
		// MCP override walking (e.g. prop interaction) — fall through to
		// the MOVING branch below even when autopilot is off.
	}

	if ((!ctx.isAutoMode && !ctx.mcpOverrideActive) || robotActions[ctx.currentAction].tags?.includes('sleep')) return;

	ctx.aiTimer -= delta;

	if (ctx.aiState === 'IDLE') {
		if (ctx.aiTimer <= 0) {
			// ── Check for props that need cleaning up ──
			if (!ctx.cleanup && !ctx.interaction && !ctx.disabledActions.has('tidyup') && !ctx.disabledActions.has('walk')) {
				// scene props which have sat too long
				const sceneIdle = Array.from(ctx.sceneProps.props.values())
					.filter(p => p.state === 'idle' && p.idleTimer >= ctx.CLEANUP_ELIGIBLE_SECONDS);
				if (sceneIdle.length > 0 && Math.random() < 0.6) {
					let nearest = sceneIdle[0];
					let bestDist = Infinity;
					for (const sp of sceneIdle) {
						const dx = sp.worldX - ctx.robot.position.x;
						const dz = sp.worldZ - ctx.robot.position.z;
						const d = dx * dx + dz * dz;
						if (d < bestDist) {
							bestDist = d;
							nearest = sp;
						}
					}
					startInteraction(ctx, nearest.id, 0, 'throw_away');
					return;
				}
				const groundProps = ctx.props.getGroundProps()
					.filter(gp => gp.timer >= ctx.CLEANUP_ELIGIBLE_SECONDS);
				if (groundProps.length > 0 && Math.random() < 0.6) {
					// Pick the nearest one
					let nearest = groundProps[0];
					let bestDist = Infinity;
					for (const gp of groundProps) {
						const dx = gp.x - ctx.robot.position.x;
						const dz = gp.z - ctx.robot.position.z;
						const d = dx * dx + dz * dz;
						if (d < bestDist) {
							bestDist = d;
							nearest = gp;
						}
					}
					startCleanup(ctx, nearest.name);
					return;
				}
			}

			const r = Math.random();
			const facingDot = ctx.getFacingDot();
			const isFacingAwayOrSide = facingDot < 0.2;
			let moveChance = 0.55;
			let performChance = 0.25;
			if (isFacingAwayOrSide) {
				moveChance = 0.7;
				performChance = 0.18;
			}
			if (r < moveChance) {
				if (ctx.disabledActions.has('walk')) {
					ctx.aiState = 'IDLE';
					ctx.aiTimer = 1;
				} else {
					ctx.aiState = 'MOVING';
					ctx.moveTarget.set(
						(Math.random() - 0.5) * ctx.moveBounds.x,
						0,
						(Math.random() - 0.5) * ctx.moveBounds.zRange + ctx.moveBounds.zNear
					);
					ctx.setRobotAction('walk');
				}
			} else if (r < moveChance + performChance) {
				const acts = getActionsByTag('idleFiller').filter((a) => !ctx.disabledActions.has(a));
				if (acts.length > 0) {
					ctx.setRobotAction(acts[Math.floor(Math.random() * acts.length)]);
				}
				ctx.aiState = 'PERFORMING';
				ctx.aiTimer = 3 + Math.random() * 4;
			} else {
				if (ctx.disabledActions.has('peek') || ctx.disabledActions.has('walk')) {
					ctx.aiState = 'IDLE';
					ctx.aiTimer = 1;
				} else {
					ctx.aiState = 'MOVING';
					const peekTarget = ctx.peekTargets[Math.floor(Math.random() * ctx.peekTargets.length)];
					ctx.moveTarget.copy(peekTarget);
					ctx.setRobotAction('walk');
				}
			}
		}
	} else if (ctx.aiState === 'MOVING') {
		const direction = new Vector3().subVectors(ctx.moveTarget, ctx.robot.position);
		const dist = direction.length();

		// CHANGE 2: Dynamic Speed & Action Selection Logic
		if (dist < 0.2 && !ctx.isTripActive) {
			ctx.robot.position.copy(ctx.moveTarget);
			ctx.currentSpeed = 0; // Reset speed on stop

			if (ctx.robot.position.z > 8) {
				ctx.aiState = 'PERFORMING';
				const isSidePeek = Math.abs(ctx.robot.position.x) > ctx.moveBounds.x * 0.2;
				ctx.setRobotAction(isSidePeek ? 'peek' : 'wave');
				ctx.aiTimer = isSidePeek ? 3.6 : 3;

				const targetRot = 0;
				let rotDiff = targetRot - ctx.robot.rotation.y;
				while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
				while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
				ctx.robot.rotation.y = targetRot;
			} else {
				ctx.aiState = 'IDLE';
				ctx.setRobotAction('idle');
				ctx.aiTimer = 1;
			}
		} else {
			direction.normalize();
			// 1. Calculate Target Speed based on distance
			// Three tiers: far (>5) = fast(8), mid (>2) = walk(3.5), close = stroll(1.8)
			let targetSpeed: number;
			if (dist > 5) targetSpeed = 8;
			else if (dist > 2) targetSpeed = 3.5;
			else targetSpeed = 1.8;
			targetSpeed *= ctx.movementSpeedMultiplier;

			// 2. Apply Camera "Shyness" (Slow down if moving toward camera)
			ctx.toCameraDir.subVectors(ctx.camera.position, ctx.robot.position).setY(0);
			const towardCamera = ctx.toCameraDir.lengthSq() > 0.0001
				? direction.dot(ctx.toCameraDir.normalize())
				: 0;

			// If moving towards camera, cap the max speed
			if (towardCamera > 0.2) targetSpeed = Math.min(targetSpeed, 3.5);
			const speedScale = towardCamera > 0.2 ? 0.75 : towardCamera < -0.2 ? 1.15 : 1;
			targetSpeed *= speedScale;

			// 3. Smooth Acceleration/Deceleration (Lerp currentSpeed)
			// factor of 4 * delta gives a nice weight (adjust for inertia)
			ctx.currentSpeed = MathUtils.lerp(ctx.currentSpeed, targetSpeed, delta * 4);

			// 4. Move Robot
			ctx.robot.position.addScaledVector(direction, ctx.currentSpeed * delta);

			// 5. Pick Correct Action (Run vs Walk vs Stroll) + Trip
			const isLocomotion = ctx.currentAction === 'walk' || ctx.currentAction === 'running' || ctx.currentAction === 'stroll';

			// Helper: determine if we're currently over an idle scene prop
			function isOverIdleProp(): boolean {
				for (const sp of ctx.sceneProps.props.values()) {
					if (sp.state !== 'idle') continue;
					const dx = sp.worldX - ctx.robot.position.x;
					const dz = sp.worldZ - ctx.robot.position.z;
					if (dx * dx + dz * dz < 1.0) {
						return true;
					}
				}
				return false;
			}

			// Handle active trip animation
			if (ctx.isTripActive) {
				ctx.tripTimer += delta;
				// Slow down during trip
				ctx.currentSpeed = MathUtils.lerp(ctx.currentSpeed, 0, delta * 3);
				if (ctx.tripTimer >= ctx.TRIP_DURATION) {
					ctx.isTripActive = false;
					ctx.tripTimer = 0;
					// Resume walking after recovery
					ctx.setRobotAction('walk');
				}
			} else if (isLocomotion) {
				// Random trip while running, but only if over a prop
				if (
					ctx.currentAction === 'running' &&
					isOverIdleProp() &&
					Math.random() < ctx.TRIP_CHANCE_PER_SECOND * delta
				) {
					ctx.isTripActive = true;
					ctx.tripTimer = 0;
					ctx.setRobotAction('tripped');
				} else {
					// Three-tier locomotion selection
					const runThreshold = 5.5;
					const strollThreshold = 2.2;
					let correctAction: RobotActionName;
					if (ctx.currentSpeed > runThreshold && ctx.isRobotAction('running')) {
						correctAction = 'running';
					} else if (ctx.currentSpeed < strollThreshold && ctx.isRobotAction('stroll')) {
						correctAction = 'stroll';
					} else {
						correctAction = 'walk';
					}
					ctx.setRobotAction(correctAction);
				}
			}

			// 6. Rotation Logic (Existing)
			const targetRot = Math.atan2(direction.x, direction.z);
			let rotDiff = targetRot - ctx.robot.rotation.y;
			while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
			while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;

			// Rotate faster if we are moving faster
			const turnSpeed = Math.max(0.1, ctx.currentSpeed * 0.03);
			ctx.robot.rotation.y += rotDiff * turnSpeed;
		}
	} else if (ctx.aiState === 'PERFORMING') {
		if (ctx.aiTimer <= 0) {
			ctx.aiState = 'IDLE';
			ctx.setRobotAction('idle');
			ctx.aiTimer = 0.5;
		}
	}
}
