import type { RobotActionDefinition } from '../types';
import { temp } from './helpers';

export const idle: RobotActionDefinition = {
	name: 'idle',
	tags: ['idleLike', 'idleFiller'],
	apply: (t, ctx) => {
		const { targets } = ctx;
		const T = temp(ctx);

		// Gentle breathing sway — scaled by temperature
		targets.body.pos.y = Math.sin(t * 1.3) * 0.08 * T;
		targets.body.rot.z = Math.sin(t * 0.7) * 0.02 * T;

		// Arms hang with natural sway — slightly offset timing
		targets.leftArm.rot.z = -0.15;
		targets.rightArm.rot.z = 0.15;
		targets.leftArm.rot.y = -0.12;
		targets.rightArm.rot.y = 0.12;
		targets.leftArm.rot.x = Math.sin(t * 0.8) * 0.06 * T;
		targets.rightArm.rot.x = -Math.sin(t * 0.8 + 0.5) * 0.06 * T;

		// Head: curious look around with occasional tilt
		targets.head.rot.x = Math.cos(t * 0.4) * 0.08 * T;
		targets.head.rot.y = Math.sin(t * 0.35) * 0.2 * T;
		targets.head.rot.z = Math.sin(t * 0.55) * 0.04 * T;

		// Subtle weight shift
		targets.body.pos.x = Math.sin(t * 0.45) * 0.04 * T;
	}
};
