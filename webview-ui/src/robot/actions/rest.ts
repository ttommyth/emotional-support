import type { RobotActionDefinition } from '../types';

export const rest: RobotActionDefinition = {
	name: 'rest',
	tags: ['idleFiller', 'idleLike', 'restPose'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		const sway = Math.sin(t * 0.9) * 0.04;
		targets.body.pos.y = -0.2 + Math.sin(t * 1.1) * 0.06;
		targets.body.rot.x = 0.08 + sway;
		targets.body.rot.z = Math.sin(t * 0.6) * 0.03;
	targets.leftArm.rot.set(-0.7 + Math.sin(t * 1.4) * 0.08, -0.2, -0.55);
	targets.rightArm.rot.set(-0.7 - Math.sin(t * 1.4) * 0.08, 0.2, 0.55);
		targets.head.rot.x = 0.18 + Math.sin(t * 0.5) * 0.06;
		targets.head.rot.y = Math.sin(t * 0.6) * 0.18;
		targets.leftLeg.rot.x = -0.2;
		targets.rightLeg.rot.x = -0.2;
	}
};
