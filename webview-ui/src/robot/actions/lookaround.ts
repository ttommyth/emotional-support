import type { RobotActionDefinition } from '../types';

export const lookaround: RobotActionDefinition = {
	name: 'lookaround',
	tags: ['idleLike', 'idleFiller'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		const phase = t % 5;
		if (phase < 2) {
			const p = phase / 2;
			targets.head.rot.y = -0.5 + p * 0.6;
			targets.head.rot.x = 0.05 + Math.sin(p * Math.PI) * 0.05;
			targets.body.rot.z = -0.02 + p * 0.04;
		} else if (phase < 4) {
			const p = (phase - 2) / 2;
			targets.head.rot.y = 0.1 + p * 0.5;
			targets.head.rot.x = 0.06 - Math.sin(p * Math.PI) * 0.04;
			targets.body.rot.z = 0.02 - p * 0.04;
		} else {
			const p = phase - 4;
			targets.head.rot.y = 0.6 - p * 0.6;
			targets.head.rot.x = 0.04;
			targets.body.rot.z = 0;
		}
		targets.leftArm.rot.z = -0.15;
		targets.rightArm.rot.z = 0.15;
		targets.leftArm.rot.y = -0.12;
		targets.rightArm.rot.y = 0.12;
	}
};
