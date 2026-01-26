import type { RobotActionDefinition } from '../types';

export const wave: RobotActionDefinition = {
	name: 'wave',
	apply: (t, { targets }) => {
		targets.rightArm.rot.set(0, 0, -2.5);
		targets.rightArm.rot.x = Math.sin(t * 10) * 0.3;
		targets.leftArm.rot.z = 0.2;
		targets.head.rot.y = Math.sin(t * 2) * 0.1;
		targets.head.rot.z = Math.sin(t * 4) * 0.1;
	}
};
