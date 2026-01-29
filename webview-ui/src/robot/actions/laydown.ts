import type { RobotActionDefinition } from '../types';

export const laydown: RobotActionDefinition = {
	name: 'laydown',
	tags: ['idleFiller', 'idleLike', 'restPose'],
	pre: {
		duration: 0.9,
		apply: (p, _t, { targets }) => {
			const eased = p * p * (3 - 2 * p);
			targets.body.pos.y = -1.6 * eased;
			targets.body.rot.x = 0.35 * eased;
			targets.body.rot.z = 0.1 * eased;
			targets.leftLeg.rot.x = -1.2 * eased;
			targets.rightLeg.rot.x = -1.2 * eased;
			targets.leftArm.rot.set(-0.6 * eased, 0.1 * eased, 0.4 * eased);
			targets.rightArm.rot.set(-0.6 * eased, -0.1 * eased, -0.4 * eased);
			targets.head.rot.set(0.3 * eased, 0.15 * eased, 0.2 * eased);
		}
	},
	apply: (t, { targets }) => {
		const breathe = Math.sin(t * 1.1) * 0.04;
		targets.body.pos.y = -1.6 + breathe;
		targets.body.rot.x = 0.35 + Math.sin(t * 0.6) * 0.03;
		targets.body.rot.z = 0.1 + Math.sin(t * 0.5) * 0.02;
		targets.leftLeg.rot.x = -1.2;
		targets.rightLeg.rot.x = -1.2;
		targets.leftArm.rot.set(-0.6, 0.1, 0.4 + Math.sin(t * 0.8) * 0.05);
		targets.rightArm.rot.set(-0.6, -0.1, -0.4 - Math.sin(t * 0.8) * 0.05);
		targets.head.rot.x = 0.3 + Math.sin(t * 0.7) * 0.05;
		targets.head.rot.y = Math.sin(t * 0.4) * 0.25;
		targets.head.rot.z = 0.2 + Math.sin(t * 0.5) * 0.03;
	},
	post: {
		duration: 0.9,
		apply: (p, _t, { targets }) => {
			const eased = p * p * (3 - 2 * p);
			targets.body.pos.y = -1.6 * (1 - eased);
			targets.body.rot.x = 0.35 * (1 - eased);
			targets.body.rot.z = 0.1 * (1 - eased);
			targets.leftLeg.rot.x = -1.2 * (1 - eased);
			targets.rightLeg.rot.x = -1.2 * (1 - eased);
			targets.leftArm.rot.set(-0.6 * (1 - eased), 0.1 * (1 - eased), 0.4 * (1 - eased));
			targets.rightArm.rot.set(-0.6 * (1 - eased), -0.1 * (1 - eased), -0.4 * (1 - eased));
			targets.head.rot.set(0.3 * (1 - eased), 0.15 * (1 - eased), 0.2 * (1 - eased));
		}
	}
};
