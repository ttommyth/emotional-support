import type { RobotActionDefinition } from '../types';

export const shrug: RobotActionDefinition = {
	name: 'shrug',
	tags: ['idleLike', 'idleFiller'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		const phase = t % 3;
		const smooth = (p: number) => p * p * (3 - 2 * p);
		if (phase < 1) {
			const p = smooth(phase);
			targets.leftArm.pos.y = 1.1 + p * 0.25;
			targets.rightArm.pos.y = 1.1 + p * 0.25;
			targets.leftArm.rot.set(-0.32, -0.25, -0.9 - p * 0.25);
			targets.rightArm.rot.set(-0.32, 0.25, 0.9 + p * 0.25);
			targets.head.rot.y = p * 0.2;
			targets.head.rot.x = -0.05 * p;
		} else if (phase < 2) {
			const p = phase - 1;
			const s = smooth(p);
			targets.leftArm.pos.y = 1.35 + Math.sin(p * Math.PI) * 0.04;
			targets.rightArm.pos.y = 1.35 + Math.sin(p * Math.PI) * 0.04;
			targets.leftArm.rot.set(-0.35, -0.22, -0.95 + s * 0.12);
			targets.rightArm.rot.set(-0.35, 0.22, 0.95 - s * 0.12);
			targets.head.rot.y = 0.2 - s * 0.3;
			targets.head.rot.x = -0.05 + Math.sin(p * Math.PI) * 0.03;
		} else {
			const p = smooth(phase - 2);
			targets.leftArm.pos.y = 1.35 - p * 0.25;
			targets.rightArm.pos.y = 1.35 - p * 0.25;
			targets.leftArm.rot.set(-0.38, -0.2, -0.9 + p * 0.12);
			targets.rightArm.rot.set(-0.38, 0.2, 0.9 - p * 0.12);
			targets.head.rot.y = -0.1 + p * 0.1;
			targets.head.rot.x = -0.02 * (1 - p);
		}
	}
};
