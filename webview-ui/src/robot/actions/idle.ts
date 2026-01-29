import type { RobotActionDefinition } from '../types';

export const idle: RobotActionDefinition = {
	name: 'idle',
	tags: ['idleLike', 'idleFiller'],
	apply: (t, { targets }) => {
		targets.body.pos.y = Math.sin(t * 1.5) * 0.1;
		targets.leftArm.rot.z = -0.15;
		targets.rightArm.rot.z = 0.15;
		targets.leftArm.rot.y = -0.12;
		targets.rightArm.rot.y = 0.12;
		targets.leftArm.rot.x = Math.sin(t) * 0.05;
		targets.rightArm.rot.x = -Math.sin(t) * 0.05;
		targets.head.rot.x = Math.cos(t * 0.4) * 0.1;
		targets.head.rot.y = Math.sin(t * 0.5) * 0.2;
	}
};
