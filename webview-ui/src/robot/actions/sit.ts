import type { RobotActionDefinition } from '../types';

export const sit: RobotActionDefinition = {
	name: 'sit',
	tags: ['idleFiller', 'idleLike', 'restPose'],
	eyeColor: 'calm',
	pre: {
		duration: 0.6,
		apply: (p, _t, { targets }) => {
			const eased = p * p * (3 - 2 * p);
			targets.body.pos.y = -0.9 * eased;
			targets.body.rot.x = 0.1 * eased;
			targets.leftLeg.rot.x = -1.0 * eased;
			targets.rightLeg.rot.x = -1.0 * eased;
			targets.leftArm.rot.set(-0.2 * eased, -0.12 * eased, -0.25 * eased);
			targets.rightArm.rot.set(-0.2 * eased, 0.12 * eased, 0.25 * eased);
			targets.head.rot.x = 0.15 * eased;
		}
	},
	apply: (t, { targets }) => {
		const sway = Math.sin(t * 1.2) * 0.03;
		targets.body.pos.y = -0.9 + Math.sin(t * 1.3) * 0.05;
		targets.body.rot.x = 0.1 + sway;
		targets.leftLeg.rot.x = -1.0;
		targets.rightLeg.rot.x = -1.0;
		targets.leftArm.rot.set(-0.25 + Math.sin(t * 1.4) * 0.05, -0.12, -0.3);
		targets.rightArm.rot.set(-0.25 - Math.sin(t * 1.4) * 0.05, 0.12, 0.3);
		targets.head.rot.x = 0.15 + Math.sin(t * 0.8) * 0.05;
		targets.head.rot.y = Math.sin(t * 0.6) * 0.2;
	},
	post: {
		duration: 0.9,
		apply: (p, _t, { targets }) => {
			const eased = p * p * p * (p * (6 * p - 15) + 10);
			targets.body.pos.y = -0.9 * (1 - eased);
			targets.body.rot.x = 0.1 * (1 - eased);
			targets.leftLeg.rot.x = -1.0 * (1 - eased);
			targets.rightLeg.rot.x = -1.0 * (1 - eased);
			targets.leftArm.rot.set(-0.2 * (1 - eased), -0.12 * (1 - eased), -0.25 * (1 - eased));
			targets.rightArm.rot.set(-0.2 * (1 - eased), 0.12 * (1 - eased), 0.25 * (1 - eased));
			targets.head.rot.x = 0.15 * (1 - eased);
		}
	}
};
