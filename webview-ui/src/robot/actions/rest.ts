import type { RobotActionDefinition } from '../types';

export const rest: RobotActionDefinition = {
	name: 'rest',
	tags: ['idleFiller', 'idleLike', 'restPose'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		// Gentle standing rest — arms crossed loosely in front
		const sway = Math.sin(t * 0.7) * 0.03;
		const breathe = Math.sin(t * 1.1) * 0.05;

		targets.body.pos.y = -0.15 + breathe;
		targets.body.rot.x = 0.06 + sway;
		targets.body.rot.z = Math.sin(t * 0.5) * 0.025;

		// Arms crossed-ish in front
		targets.leftArm.rot.set(-0.8 + Math.sin(t * 0.8) * 0.05, 0.3, -0.3);
		targets.rightArm.rot.set(-0.8 - Math.sin(t * 0.8) * 0.05, -0.3, 0.3);

		// Head droops with slow look-around
		targets.head.rot.x = 0.15 + Math.sin(t * 0.5) * 0.06;
		targets.head.rot.y = Math.sin(t * 0.4) * 0.2;
		targets.head.rot.z = Math.sin(t * 0.6) * 0.03;

		// Weight on one leg, slight knee bend
		targets.leftLeg.rot.x = -0.15;
		targets.rightLeg.rot.x = -0.08 + Math.sin(t * 0.3) * 0.03;
	}
};
