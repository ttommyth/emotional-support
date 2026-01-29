import type { RobotActionDefinition } from '../types';

export const dance: RobotActionDefinition = {
	name: 'dance',
	tags: ['idleFiller'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		const phase = t % 4;
		const sway = Math.sin(t * 2.2) * 0.22;
		const bounce = Math.abs(Math.sin(t * 2.8)) * 0.18;
		targets.body.pos.x = sway * 0.7;
		targets.body.pos.y = bounce;
		targets.body.rot.z = sway * 0.45;
		targets.leftArm.pos.y = 1.15;
		targets.rightArm.pos.y = 1.15;
		if (phase < 2) {
			const p = phase / 2;
			targets.leftArm.rot.z = -0.9 - sway - p * 0.25;
			targets.rightArm.rot.z = 0.9 - sway + p * 0.25;
			targets.leftArm.rot.y = -0.25;
			targets.rightArm.rot.y = 0.25;
			targets.head.rot.y = Math.sin(t * 1.6) * 0.28;
			const step = Math.sin(p * Math.PI);
			targets.leftLeg.rot.x = step * 0.5;
			targets.rightLeg.rot.x = -step * 0.5;
		} else {
			const p = (phase - 2) / 2;
			targets.leftArm.rot.z = -1.0 - sway + p * 0.3;
			targets.rightArm.rot.z = 1.0 - sway - p * 0.3;
			targets.leftArm.rot.y = -0.22;
			targets.rightArm.rot.y = 0.22;
			targets.head.rot.y = Math.sin(t * 1.6 + 1) * 0.28;
			const step = Math.sin(p * Math.PI);
			targets.leftLeg.rot.x = -step * 0.5;
			targets.rightLeg.rot.x = step * 0.5;
		}
	}
};
