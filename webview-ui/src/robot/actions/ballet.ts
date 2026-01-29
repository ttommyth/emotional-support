import type { RobotActionDefinition } from '../types';

const spinDuration = 2.2;

export const ballet: RobotActionDefinition = {
	name: 'ballet',
	tags: ['idleFiller', 'idleLike', 'movement'],
	eyeColor: 'purple',
	pre: {
		duration: 0.6,
		apply: (p, _t, { targets }) => {
			const eased = p * p * (3 - 2 * p);
			targets.body.pos.y = 0.2 * eased;
			targets.body.rot.y = eased * Math.PI * 2;
			targets.leftLeg.rot.x = -0.3 * eased;
			targets.rightLeg.rot.x = -0.3 * eased;
			targets.leftArm.rot.set(-0.3 * eased, -0.35 * eased, -1.1 * eased);
			targets.rightArm.rot.set(-0.3 * eased, 0.35 * eased, 1.1 * eased);
			targets.head.rot.y = 0.2 * eased;
		}
	},
	apply: (t, { targets }) => {
		const phase = (t % spinDuration) / spinDuration;
		const turn = phase * Math.PI * 2;
		const lift = Math.sin(phase * Math.PI) * 0.25;
		targets.body.pos.y = 0.2 + lift;
		targets.body.rot.y = turn;
		targets.body.rot.z = Math.sin(phase * Math.PI * 2) * 0.03;
		targets.leftLeg.rot.x = -0.6 + Math.sin(t * 3) * 0.1;
		targets.rightLeg.rot.x = -0.2;
		targets.leftArm.rot.set(-0.5, -0.35, -1.25);
		targets.rightArm.rot.set(-0.5, 0.35, 1.25);
		targets.head.rot.y = Math.sin(t * 0.6) * 0.2;
	},
	post: {
		duration: 0.9,
		apply: (p, _t, { targets }) => {
			const eased = p * p * p * (p * (6 * p - 15) + 10);
			targets.body.pos.y = 0.2 * (1 - eased);
			targets.body.rot.y = (1 - eased) * Math.PI * 2;
			targets.leftLeg.rot.x = -0.3 * (1 - eased);
			targets.rightLeg.rot.x = -0.3 * (1 - eased);
			targets.leftArm.rot.set(-0.3 * (1 - eased), -0.35 * (1 - eased), -1.1 * (1 - eased));
			targets.rightArm.rot.set(-0.3 * (1 - eased), 0.35 * (1 - eased), 1.1 * (1 - eased));
			targets.head.rot.y = 0.2 * (1 - eased);
		}
	}
};
