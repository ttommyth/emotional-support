/**
 * stroll — Slow, casual saunter. Slower than walking.
 * Gentle swaying, looking around, arms relaxed at sides.
 */

import type { RobotActionDefinition } from '../types';

export const stroll: RobotActionDefinition = {
	name: 'stroll',
	tags: ['blocksAutoLookAt', 'skipPost', 'movement'],
	eyeColor: 'calm',
	apply: (t, { targets }) => {
		const speed = 4;
		const stride = Math.sin(t * speed);
		const lift = Math.abs(stride);

		// Body: gentle sway, slight lean, relaxed bounce
		targets.body.pos.y = lift * 0.1;
		targets.body.rot.x = 0.02;
		targets.body.rot.z = Math.sin(t * speed * 0.5) * 0.04;

		// Legs: small lazy steps
		targets.leftLeg.rot.x = stride * 0.35;
		targets.rightLeg.rot.x = -stride * 0.35;

		// Arms: relaxed swing, barely moving — hands almost at sides
		targets.leftArm.rot.x = -stride * 0.2;
		targets.rightArm.rot.x = stride * 0.2;
		targets.leftArm.rot.z = -0.1;
		targets.rightArm.rot.z = 0.1;

		// Head: curious wandering gaze, slow and relaxed
		targets.head.rot.x = -0.03 + Math.sin(t * 0.8) * 0.06;
		targets.head.rot.y = Math.sin(t * 0.6) * 0.15;
		targets.head.rot.z = Math.sin(t * 0.9) * 0.04;
	}
};
