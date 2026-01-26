import type { RobotActionDefinition } from '../types';

export const stretch: RobotActionDefinition = {
	name: 'stretch',
	apply: (t, { targets }) => {
		const phase = t % 6;
		const lift = Math.abs(Math.sin(t * 0.9)) * 0.18;
		targets.body.pos.y = lift;
		if (phase < 2) {
			const p = phase / 2;
			targets.leftArm.pos.y = 1.1 + p * 0.15;
			targets.rightArm.pos.y = 1.1 + p * 0.15;
			targets.leftArm.rot.set(-1.6 - p * 0.6, 0, 0.2 + p * 0.2);
			targets.rightArm.rot.set(-1.6 - p * 0.6, 0, -0.2 - p * 0.2);
			targets.head.rot.x = -0.05 - p * 0.05;
		} else if (phase < 4) {
			const p = (phase - 2) / 2;
			targets.leftArm.pos.y = 1.25 + Math.sin(p * Math.PI) * 0.1;
			targets.rightArm.pos.y = 1.25 + Math.sin(p * Math.PI) * 0.1;
			targets.leftArm.rot.set(-2.2, 0, 0.35 + Math.sin(p * Math.PI) * 0.1);
			targets.rightArm.rot.set(-2.2, 0, -0.35 - Math.sin(p * Math.PI) * 0.1);
			targets.head.rot.x = -0.1 + Math.sin(p * Math.PI) * 0.03;
		} else {
			const p = (phase - 4) / 2;
			targets.leftArm.pos.y = 1.25 - p * 0.15;
			targets.rightArm.pos.y = 1.25 - p * 0.15;
			targets.leftArm.rot.set(-2.2 + p * 0.8, 0, 0.35 - p * 0.15);
			targets.rightArm.rot.set(-2.2 + p * 0.8, 0, -0.35 + p * 0.15);
			targets.head.rot.x = -0.1 + p * 0.05;
		}
	}
};