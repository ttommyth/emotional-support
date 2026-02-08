/**
 * tripped — Robot stumbles forward and faceplants, then gets back up.
 *
 * Three phases driven by elapsed time:
 *   0–0.4s   stumble: foot catches, body pitches forward
 *   0.4–1.0s fall: full faceplant on the ground
 *   1.0–2.2s recover: pushes up, shakes head, stands
 *
 * The action is applied by the main loop; external code is responsible for
 * setting `tripped` as the action and switching back to locomotion afterward.
 */

import type { RobotActionDefinition } from '../types';
import { smoothStep } from './helpers';

/** Total duration of the full trip cycle (seconds) */
export const TRIP_DURATION = 2.6;

export const tripped: RobotActionDefinition = {
	name: 'tripped',
	tags: ['blocksAutoLookAt', 'blocksBlink', 'skipPost', 'movement'],
	eyeColor: 'purple',
	apply: (t, { targets }) => {
		// Use a looping local timer so the animation always starts from 0
		// when the action is first set. The caller resets actionPhaseTimer.
		// We read from the global time value, but the phase-based approach
		// works because apply is called every frame.
		// Instead: use modular time within the TRIP_DURATION window.
		const local = t % TRIP_DURATION;

		if (local < 0.4) {
			// ── Phase 1: Stumble ──
			const p = smoothStep(local / 0.4);

			// Body lurches forward and down
			targets.body.pos.set(0, -0.5 * p, 0.8 * p);
			targets.body.rot.set(0.5 * p, 0, 0.15 * p);

			// Arms flail outward trying to catch balance
			targets.leftArm.rot.set(-1.0 * p, 0, -0.8 * p);
			targets.rightArm.rot.set(-0.6 * p, 0, 1.0 * p);

			// Front leg buckles, back leg kicks up
			targets.leftLeg.rot.set(0.6 * p, 0, 0);
			targets.rightLeg.rot.set(-0.8 * p, 0, 0);

			// Head jerks forward
			targets.head.rot.set(0.3 * p, 0.2 * p, 0);
		} else if (local < 1.0) {
			// ── Phase 2: Faceplant / lying on ground ──
			const p = smoothStep((local - 0.4) / 0.6);

			// Slam down
			targets.body.pos.set(0, -3.2 * p - 0.5 * (1 - p), 1.5 * p + 0.8 * (1 - p));
			targets.body.rot.set(1.2 * p + 0.5 * (1 - p), 0, 0.15 * (1 - p));

			// Arms splay out to break fall, then relax
			const armRelax = p > 0.6 ? (p - 0.6) / 0.4 : 0;
			targets.leftArm.rot.set(-1.5 + 0.5 * armRelax, 0, -1.0 + 0.3 * armRelax);
			targets.rightArm.rot.set(-1.5 + 0.5 * armRelax, 0, 1.0 - 0.3 * armRelax);

			// Legs crumple
			targets.leftLeg.rot.set(0.3 * (1 - p), 0, 0.2 * p);
			targets.rightLeg.rot.set(-0.2 * (1 - p), 0, -0.2 * p);

			// Face hits floor
			targets.head.rot.set(0.5, Math.sin(local * 6) * 0.1 * (1 - p), 0);
		} else {
			// ── Phase 3: Recovery — push up and stand ──
			const p = smoothStep((local - 1.0) / 1.6);

			// Rise from the ground
			const bodyY = -3.2 * (1 - p);
			const bodyZ = 1.5 * (1 - p);
			const bodyRotX = 1.2 * (1 - p);
			targets.body.pos.set(0, bodyY, bodyZ);
			targets.body.rot.set(bodyRotX, 0, 0);

			if (p < 0.4) {
				// Pushup phase — arms push against ground
				const pp = p / 0.4;
				targets.leftArm.rot.set(-1.0 + 0.5 * pp, 0, -0.7 + 0.5 * pp);
				targets.rightArm.rot.set(-1.0 + 0.5 * pp, 0, 0.7 - 0.5 * pp);
			} else {
				// Standing up — arms return to natural position
				const sp = (p - 0.4) / 0.6;
				targets.leftArm.rot.set(-0.5 * (1 - sp), 0, -0.2 * (1 - sp));
				targets.rightArm.rot.set(-0.5 * (1 - sp), 0, 0.2 * (1 - sp));
			}

			// Legs straighten
			targets.leftLeg.rot.set(0.2 * (1 - p) * Math.max(0, 1 - p * 2), 0, 0.2 * (1 - p));
			targets.rightLeg.rot.set(-0.2 * (1 - p) * Math.max(0, 1 - p * 2), 0, -0.2 * (1 - p));

			// Head: shake off dizziness
			const headShake = p > 0.5 ? Math.sin((p - 0.5) * 20) * 0.15 * (1 - p) : 0;
			targets.head.rot.set(-0.1 * (1 - p), headShake, 0);
		}
	}
};
