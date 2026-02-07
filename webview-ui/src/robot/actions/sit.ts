import type { RobotActionDefinition } from '../types';
import { createPoseTransitions } from './helpers';

const transitions = createPoseTransitions(
	(eased, _t, { targets }) => {
		targets.body.pos.y = -0.9 * eased;
		targets.body.rot.x = 0.1 * eased;
		targets.leftLeg.rot.x = -1.0 * eased;
		targets.rightLeg.rot.x = -1.0 * eased;
		targets.leftArm.rot.set(-0.2 * eased, -0.12 * eased, -0.25 * eased);
		targets.rightArm.rot.set(-0.2 * eased, 0.12 * eased, 0.25 * eased);
		targets.head.rot.x = 0.15 * eased;
	},
	0.6,
	0.9
);

export const sit: RobotActionDefinition = {
	name: 'sit',
	tags: ['idleFiller', 'idleLike', 'restPose'],
	eyeColor: 'calm',
	pre: transitions.pre,
	apply: (t, { targets }) => {
		// Seated pose with idle fidgeting
		const breathe = Math.sin(t * 1.1) * 0.04;

		targets.body.pos.y = -0.9 + breathe;
		targets.body.rot.x = 0.1 + Math.sin(t * 0.7) * 0.02;
		targets.body.rot.z = Math.sin(t * 0.5) * 0.02;

		// Legs bent, occasional foot tap
		targets.leftLeg.rot.x = -1.0;
		targets.rightLeg.rot.x = -1.0 + Math.sin(t * 2.5) * 0.06;

		// Arms rest on knees, one occasionally lifts
		const fidget = (t % 8) < 5;
		targets.leftArm.rot.set(
			-0.3 + Math.sin(t * 0.9) * 0.04,
			-0.12,
			-0.25 + (fidget ? Math.sin(t * 0.6) * 0.05 : 0)
		);
		targets.rightArm.rot.set(
			-0.3 - Math.sin(t * 0.9) * 0.04,
			0.12,
			0.25 - (fidget ? 0 : Math.sin(t * 0.8) * 0.08)
		);

		// Head: content look around
		targets.head.rot.x = 0.1 + Math.sin(t * 0.5) * 0.06;
		targets.head.rot.y = Math.sin(t * 0.35) * 0.25;
		targets.head.rot.z = Math.sin(t * 0.7) * 0.04;
	},
	post: transitions.post
};
