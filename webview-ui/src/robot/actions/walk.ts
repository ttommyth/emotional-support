import type { RobotActionDefinition } from '../types';
import { temp } from './helpers';

export const walk: RobotActionDefinition = {
	name: 'walk',
	tags: ['blocksAutoLookAt', 'skipPost', 'movement'],
	eyeColor: 'cyan',
	apply: (t, ctx) => {
		const { targets } = ctx;
		const T = temp(ctx);

		const speed = 8;
		const stride = Math.sin(t * speed);
		const lift = Math.abs(stride);

		// Body: vertical bounce + slight lean forward + hip sway
		targets.body.pos.y = lift * 0.22 * T;
		targets.body.rot.x = 0.04;
		targets.body.rot.z = Math.sin(t * speed * 0.5) * 0.06 * T;

		// Legs: asymmetric stride — forward leg bends more
		targets.leftLeg.rot.x = stride * 0.7 * T;
		targets.rightLeg.rot.x = -stride * 0.7 * T;

		// Arms: natural counter-swing with slight bend
		targets.leftArm.rot.x = -stride * 0.5 * T;
		targets.rightArm.rot.x = stride * 0.5 * T;
		targets.leftArm.rot.z = -0.15 + lift * 0.05 * T;
		targets.rightArm.rot.z = 0.15 - lift * 0.05 * T;

		// Head: gentle bob and slight look sway
		targets.head.rot.x = -0.05 + lift * 0.06 * T;
		targets.head.rot.y = Math.sin(t * speed * 0.5) * 0.08 * T;
	}
};
