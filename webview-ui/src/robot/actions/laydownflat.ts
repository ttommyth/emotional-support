import type { RobotActionDefinition } from '../types';

export const laydownflat: RobotActionDefinition = {
	name: 'laydownflat',
	tags: ['idleFiller', 'idleLike', 'restPose'],
	eyeColor: 'off',
	pre: {
		duration: 1.0,
		apply: (p, _t, { targets }) => {
			const eased = p * p * (3 - 2 * p);
		targets.body.pos.y = -4.0 * eased;
		targets.body.rot.x = -1.45 * eased;
		targets.body.rot.z = 0.05 * eased;
		targets.leftLeg.rot.x = -0.6 * eased;
		targets.rightLeg.rot.x = -0.6 * eased;
		targets.leftArm.rot.set(0.4 * eased, -0.2 * eased, -1.1 * eased);
		targets.rightArm.rot.set(0.4 * eased, 0.2 * eased, 1.1 * eased);
		targets.head.rot.set(-0.2 * eased, 0, 0.2 * eased);
		}
	},
	apply: (t, { targets }) => {
		const breathe = Math.sin(t * 0.9) * 0.03;
		targets.body.pos.y = -4.0 + breathe;
		targets.body.rot.x = -1.45 + Math.sin(t * 0.4) * 0.02;
		targets.body.rot.z = 0.05 + Math.sin(t * 0.3) * 0.01;
		targets.leftLeg.rot.x = -0.6;
		targets.rightLeg.rot.x = -0.6;
		targets.leftArm.rot.set(0.4, -0.2, -1.1);
		targets.rightArm.rot.set(0.4, 0.2, 1.1);
		targets.head.rot.x = -0.2 + Math.sin(t * 0.4) * 0.02;
		targets.head.rot.z = 0.2 + Math.sin(t * 0.3) * 0.02;
	},
	post: {
		duration: 1.4,
		apply: (p, _t, { targets }) => {
			const eased = p * p * p * (p * (6 * p - 15) + 10);
			targets.body.pos.y = -4.0 * (1 - eased);
			targets.body.rot.x = -1.45 * (1 - eased);
			targets.body.rot.z = 0.05 * (1 - eased);
		targets.leftLeg.rot.x = -0.6 * (1 - eased);
		targets.rightLeg.rot.x = -0.6 * (1 - eased);
		targets.leftArm.rot.set(0.4 * (1 - eased), -0.2 * (1 - eased), -1.1 * (1 - eased));
		targets.rightArm.rot.set(0.4 * (1 - eased), 0.2 * (1 - eased), 1.1 * (1 - eased));
		targets.head.rot.set(-0.2 * (1 - eased), 0, 0.2 * (1 - eased));
		}
	}
};
