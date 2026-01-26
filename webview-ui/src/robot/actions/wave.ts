import type { RobotActionDefinition } from '../types';

export const wave: RobotActionDefinition = {
	name: 'wave',
	apply: (t, { targets }) => {
		const phase = t % 3.5;
		targets.rightArm.pos.y = 1.15;
		if (phase < 0.8) {
			const p = phase / 0.8;
			targets.rightArm.rot.set(0, 0, -2.1 - p * 0.3);
			targets.rightArm.rot.x = Math.sin(p * Math.PI) * 0.12;
		} else if (phase < 2.8) {
			const p = phase - 0.8;
			targets.rightArm.rot.set(0, 0, -2.4);
			targets.rightArm.rot.x = Math.sin(p * 8) * 0.2;
		} else {
			const p = (phase - 2.8) / 0.7;
			targets.rightArm.rot.set(0, 0, -2.4 + p * 0.3);
			targets.rightArm.rot.x = Math.sin(p * Math.PI) * 0.1;
		}
		targets.leftArm.rot.z = 0.2;
		targets.head.rot.y = Math.sin(t * 1.6) * 0.08;
		targets.head.rot.z = Math.sin(t * 3) * 0.08;
	}
};
