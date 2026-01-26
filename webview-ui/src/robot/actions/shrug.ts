import type { RobotActionDefinition } from '../types';

export const shrug: RobotActionDefinition = {
	name: 'shrug',
	apply: (t, { targets }) => {
		const phase = t % 3;
		if (phase < 1) {
			const p = phase;
			targets.leftArm.pos.y = 1.1 + p * 0.2;
			targets.rightArm.pos.y = 1.1 + p * 0.2;
			targets.leftArm.rot.set(-0.35, 0, 0.55);
			targets.rightArm.rot.set(-0.35, 0, -0.55);
			targets.head.rot.y = p * 0.2;
		} else if (phase < 2) {
			const p = phase - 1;
			targets.leftArm.pos.y = 1.3 + Math.sin(p * Math.PI) * 0.05;
			targets.rightArm.pos.y = 1.3 + Math.sin(p * Math.PI) * 0.05;
			targets.leftArm.rot.set(-0.35, 0, 0.6);
			targets.rightArm.rot.set(-0.35, 0, -0.6);
			targets.head.rot.y = 0.2 - p * 0.3;
		} else {
			const p = phase - 2;
			targets.leftArm.pos.y = 1.3 - p * 0.2;
			targets.rightArm.pos.y = 1.3 - p * 0.2;
			targets.leftArm.rot.set(-0.4, 0, 0.55);
			targets.rightArm.rot.set(-0.4, 0, -0.55);
			targets.head.rot.y = -0.1 + p * 0.1;
		}
	}
};