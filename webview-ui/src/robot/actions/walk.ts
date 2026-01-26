import type { RobotActionDefinition } from '../types';

export const walk: RobotActionDefinition = {
	name: 'walk',
	apply: (t, { targets }) => {
		const speed = 10;
		targets.body.pos.y = Math.abs(Math.sin(t * speed)) * 0.2;
		targets.body.rot.z = Math.sin(t * speed / 2) * 0.05;
		targets.leftLeg.rot.x = Math.sin(t * speed) * 0.8;
		targets.rightLeg.rot.x = Math.sin(t * speed + Math.PI) * 0.8;
		targets.leftArm.rot.x = Math.sin(t * speed + Math.PI) * 0.8;
		targets.rightArm.rot.x = Math.sin(t * speed) * 0.8;
		targets.leftArm.rot.z = 0.1;
		targets.rightArm.rot.z = -0.1;
	}
};
