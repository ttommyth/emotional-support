import type { RobotActionDefinition } from '../types';

export const stretch: RobotActionDefinition = {
	name: 'stretch',
	tags: ['idleLike', 'idleFiller'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		const phase = t % 7;

		if (phase < 2) {
			// Raising arms up — big yawn stretch
			const p = phase / 2;
			const e = p * p * (3 - 2 * p);
			targets.leftArm.pos.y = 1.5 + e * 0.3;
			targets.rightArm.pos.y = 1.5 + e * 0.3;
			targets.leftArm.rot.set(-2.8 * e, -0.2 * e, -0.5 * e);
			targets.rightArm.rot.set(-2.8 * e, 0.2 * e, 0.5 * e);
			targets.body.pos.y = e * 0.25;
			targets.body.rot.x = -0.06 * e;
			targets.head.rot.x = -0.15 * e;
		} else if (phase < 4.5) {
			// Full stretch hold — arms way up, body extended, gentle sway
			const p = (phase - 2) / 2.5;
			targets.leftArm.pos.y = 1.8;
			targets.rightArm.pos.y = 1.8;
			targets.leftArm.rot.set(-2.8, -0.2 + Math.sin(p * Math.PI) * 0.1, -0.5 - Math.sin(p * Math.PI) * 0.15);
			targets.rightArm.rot.set(-2.8, 0.2 - Math.sin(p * Math.PI) * 0.1, 0.5 + Math.sin(p * Math.PI) * 0.15);
			targets.body.pos.y = 0.25 + Math.sin(p * Math.PI) * 0.08;
			targets.body.rot.x = -0.06;
			targets.body.rot.z = Math.sin(p * Math.PI * 2) * 0.04;
			targets.head.rot.x = -0.15 + Math.sin(p * Math.PI) * 0.05;
		} else {
			// Lowering arms — relaxing sigh
			const p = (phase - 4.5) / 2.5;
			const e = p * p * (3 - 2 * p);
			targets.leftArm.pos.y = 1.8 - e * 0.3;
			targets.rightArm.pos.y = 1.8 - e * 0.3;
			targets.leftArm.rot.set(-2.8 * (1 - e), -0.2 * (1 - e), -0.5 * (1 - e));
			targets.rightArm.rot.set(-2.8 * (1 - e), 0.2 * (1 - e), 0.5 * (1 - e));
			targets.body.pos.y = 0.25 * (1 - e) - 0.05 * e;
			targets.body.rot.x = -0.06 * (1 - e) + 0.03 * e;
			targets.head.rot.x = -0.15 * (1 - e) + 0.05 * e;
		}
	}
};
