import type { RobotActionDefinition } from '../types';
import { temp } from './helpers';

export const error: RobotActionDefinition = {
	name: 'error',
	tags: ['work', 'blocksBlink'],
	eyeColor: 'red',
	apply: (t, ctx) => {
		const { targets } = ctx;
		const T = temp(ctx);

		const phase = t % 5;
		// Occasional frustrated shake bursts, not constant vibration
		const shaking = phase < 1.2;
		const shake = shaking ? Math.sin(t * 18) * 0.06 * T * (1 - phase / 1.2) : 0;

		targets.body.pos.x = shake;
		targets.body.pos.y = -0.15 + Math.sin(t * 1.2) * 0.04 * T;
		targets.body.rot.x = 0.05;
		targets.body.rot.z = shake * 2;

		// Hands-on-head frustrated pose
		targets.leftArm.rot.set(-2.4, -0.3, -0.4);
		targets.rightArm.rot.set(-2.4, 0.3, 0.4);
		targets.leftArm.pos.y = 1.5 + (shaking ? Math.sin(t * 12) * 0.06 * T : 0);
		targets.rightArm.pos.y = 1.5 + (shaking ? Math.cos(t * 12) * 0.06 * T : 0);

		// Head droops between shakes, shakes during burst
		if (shaking) {
			targets.head.rot.y = Math.sin(t * 14) * 0.15 * T;
			targets.head.rot.x = -0.1 + Math.sin(t * 10) * 0.05 * T;
		} else {
			// Slow frustrated sway
			targets.head.rot.x = 0.2 + Math.sin(t * 0.8) * 0.06 * T;
			targets.head.rot.y = Math.sin(t * 0.6) * 0.25 * T;
			targets.head.rot.z = Math.sin(t * 0.9) * 0.05 * T;
		}
	}
};
