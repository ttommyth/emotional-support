import type { RobotActionDefinition } from '../types';

export const error: RobotActionDefinition = {
	name: 'error',
	tags: ['work', 'blocksBlink'],
	apply: (t, { targets }) => {
		targets.body.pos.x = Math.sin(t * 50) * 0.05;
		targets.head.rot.y = Math.sin(t * 30) * 0.5;
		targets.leftArm.rot.set(Math.sin(t * 20) * 0.2, 0, -2.8);
		targets.rightArm.rot.set(Math.cos(t * 20) * 0.2, 0, 2.8);
	}
};
