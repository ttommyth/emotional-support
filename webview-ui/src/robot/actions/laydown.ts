import type { RobotActionDefinition } from '../types';
import { createPoseTransitions } from './helpers';

const transitions = createPoseTransitions(
	(eased, _t, { targets }) => {
		targets.body.pos.y = -1.6 * eased;
		targets.body.rot.x = 0.35 * eased;
		targets.body.rot.z = 0.1 * eased;
		targets.leftLeg.rot.x = -1.2 * eased;
		targets.rightLeg.rot.x = -1.2 * eased;
		targets.leftArm.rot.set(-0.6 * eased, -0.15 * eased, -0.55 * eased);
		targets.rightArm.rot.set(-0.6 * eased, 0.15 * eased, 0.55 * eased);
		targets.head.rot.set(0.3 * eased, 0.15 * eased, 0.2 * eased);
	},
	0.9,
	1.2
);

export const laydown: RobotActionDefinition = {
	name: 'laydown',
	tags: ['idleFiller', 'idleLike', 'restPose'],
	eyeColor: 'calm',
	pre: transitions.pre,
	apply: (t, { targets }) => {
		const breathe = Math.sin(t * 1.1) * 0.04;
		targets.body.pos.y = -1.6 + breathe;
		targets.body.rot.x = 0.35 + Math.sin(t * 0.6) * 0.03;
		targets.body.rot.z = 0.1 + Math.sin(t * 0.5) * 0.02;
		targets.leftLeg.rot.x = -1.2;
		targets.rightLeg.rot.x = -1.2;
		targets.leftArm.rot.set(-0.6, -0.15, -0.55 + Math.sin(t * 0.8) * 0.04);
		targets.rightArm.rot.set(-0.6, 0.15, 0.55 - Math.sin(t * 0.8) * 0.04);
		targets.head.rot.x = 0.3 + Math.sin(t * 0.7) * 0.05;
		targets.head.rot.y = Math.sin(t * 0.4) * 0.25;
		targets.head.rot.z = 0.2 + Math.sin(t * 0.5) * 0.03;
	},
	post: transitions.post
};
