import type { RobotActionDefinition } from '../types';

export const running: RobotActionDefinition = {
	name: 'running',
	tags: ['blocksAutoLookAt', 'skipPost', 'movement'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		const speed = 16;
		const stride = Math.sin(t * speed);
		const lift = Math.abs(stride) * 0.35;
		targets.body.pos.y = lift * 0.6;
		targets.body.rot.x = 0.08 + Math.sin(t * speed * 0.5) * 0.05;
		targets.body.rot.z = Math.sin(t * speed * 0.5) * 0.06;
		targets.leftLeg.rot.x = stride * 1.2;
		targets.rightLeg.rot.x = -stride * 1.2;
		targets.leftArm.rot.x = -stride * 1.0;
		targets.rightArm.rot.x = stride * 1.0;
		targets.leftArm.rot.z = 0.2;
		targets.rightArm.rot.z = -0.2;
		targets.head.rot.x = -0.1 + Math.sin(t * 2.4) * 0.05;
		targets.head.rot.y = Math.sin(t * 1.2) * 0.1;
	}
};
