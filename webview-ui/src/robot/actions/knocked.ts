import type { RobotActionDefinition } from '../types';

export const knocked: RobotActionDefinition = {
	name: 'knocked',
	tags: ['blocksAutoLookAt'],
	eyeColor: 'purple',
	apply: (t, { targets }) => {
		targets.body.pos.y = Math.max(0, Math.sin(t * 15)) * 1;
		targets.head.rot.x = -0.2;
		targets.head.rot.z = Math.sin(t * 10) * 0.1;
		targets.leftArm.rot.set(0, 0, -1.0);
		targets.rightArm.rot.set(0, 0, 1.0);
	}
};
