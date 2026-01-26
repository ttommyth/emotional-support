import type { RobotActionDefinition } from '../types';

export const dance: RobotActionDefinition = {
	name: 'dance',
	apply: (t, { targets }) => {
		const phase = t % 4;
		const sway = Math.sin(t * 2.2) * 0.16;
		targets.body.pos.x = sway * 0.5;
		targets.body.rot.z = sway * 0.35;
		targets.leftArm.pos.y = 1.15;
		targets.rightArm.pos.y = 1.15;
		if (phase < 2) {
			const p = phase / 2;
			targets.leftArm.rot.z = 0.45 + sway + p * 0.15;
			targets.rightArm.rot.z = -0.45 + sway - p * 0.15;
			targets.head.rot.y = Math.sin(t * 1.4) * 0.2;
			const step = Math.sin(p * Math.PI);
			targets.leftLeg.rot.x = step * 0.25;
			targets.rightLeg.rot.x = -step * 0.25;
		} else {
			const p = (phase - 2) / 2;
			targets.leftArm.rot.z = 0.6 + sway - p * 0.2;
			targets.rightArm.rot.z = -0.6 + sway + p * 0.2;
			targets.head.rot.y = Math.sin(t * 1.4 + 1) * 0.2;
			const step = Math.sin(p * Math.PI);
			targets.leftLeg.rot.x = -step * 0.25;
			targets.rightLeg.rot.x = step * 0.25;
		}
	}
};