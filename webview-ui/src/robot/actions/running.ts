import type { RobotActionDefinition } from '../types';
import { temp } from './helpers';

export const running: RobotActionDefinition = {
	name: 'running',
	tags: ['blocksAutoLookAt', 'skipPost', 'movement'],
	eyeColor: 'cyan',
	apply: (t, ctx) => {
		const { targets } = ctx;
		const T = temp(ctx);

		const speed = 14;
		const stride = Math.sin(t * speed);
		const lift = Math.abs(stride);

		// Body: bigger bounce, lean forward, hip twist
		targets.body.pos.y = lift * 0.5 * T;
		targets.body.rot.x = 0.12;
		targets.body.rot.z = Math.sin(t * speed * 0.5) * 0.08 * T;
		targets.body.rot.y = Math.sin(t * speed * 0.5) * 0.04 * T;

		// Legs: high knees, exaggerated stride
		targets.leftLeg.rot.x = stride * 1.1 * T;
		targets.rightLeg.rot.x = -stride * 1.1 * T;

		// Arms: big pumps, elbows bent
		targets.leftArm.rot.x = -stride * 1.2 * T;
		targets.rightArm.rot.x = stride * 1.2 * T;
		targets.leftArm.rot.z = -0.25;
		targets.rightArm.rot.z = 0.25;
		targets.leftArm.rot.y = stride * 0.15 * T;
		targets.rightArm.rot.y = -stride * 0.15 * T;

		// Head: determined look with slight bob
		targets.head.rot.x = -0.08 + lift * 0.08 * T;
		targets.head.rot.y = Math.sin(t * 1.5) * 0.06 * T;
	}
};
