/**
 * tidyup — Robot performs a pickup-style bend animation.
 * Used both as an explicit action and as the cleanup animation when
 * the robot autonomously picks up ground props.
 */

import { defineAction, smoothStep } from './helpers';

export const tidyup = defineAction({
	name: 'tidyup',
	tags: ['idleFiller'],
	eyeColor: 'green',
	apply: (time, { targets }) => {
		// Loop a pickup-style bend (matches cleanup bend posture)
		const p = (Math.sin(time * 1.2) + 1) / 2;
		const eased = smoothStep(p);

		targets.body.pos.set(0, -1.5 * eased, 0.5 * eased);
		targets.body.rot.set(0.6 * eased, 0, 0);
		targets.leftArm.rot.set(-0.8 * eased, 0, 0.3 * eased);
		targets.rightArm.rot.set(-0.8 * eased, 0, -0.3 * eased);
		targets.head.rot.set(0.2 * eased, 0, 0);

		// Legs slightly bent for balance
		targets.leftLeg.rot.set(0.15 * eased, 0, 0);
		targets.rightLeg.rot.set(0.15 * eased, 0, 0);
	}
});
