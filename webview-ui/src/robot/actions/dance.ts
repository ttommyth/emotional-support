import type { RobotActionDefinition } from '../types';
import { temp } from './helpers';

export const dance: RobotActionDefinition = {
	name: 'dance',
	tags: ['idleFiller'],
	eyeColor: 'cyan',
	apply: (t, ctx) => {
		const { targets } = ctx;
		const T = temp(ctx);

		const phase = t % 6;
		const beat = Math.abs(Math.sin(t * 3.2));
		const sway = Math.sin(t * 1.6);

		// Core bounce — on every beat
		targets.body.pos.y = beat * 0.22 * T;
		targets.body.pos.x = sway * 0.4 * T;
		targets.body.rot.z = sway * 0.12 * T;

		if (phase < 2) {
			// Disco arms — alternating up/down
			const p = phase / 2;
			targets.leftArm.rot.set(-2.2 * beat, -0.15, -0.6 - beat * 0.3 * T);
			targets.rightArm.rot.set(-0.5, 0.15, 0.4);
			targets.leftArm.pos.y = 1.5 + beat * 0.15 * T;
			targets.head.rot.y = sway * 0.25 * T;
			targets.head.rot.z = Math.sin(t * 3.2) * 0.1 * T;
			targets.leftLeg.rot.x = Math.sin(p * Math.PI * 2) * 0.4 * T;
			targets.rightLeg.rot.x = -Math.sin(p * Math.PI * 2) * 0.4 * T;
		} else if (phase < 4) {
			// Switch arms — other side
			const p = (phase - 2) / 2;
			targets.rightArm.rot.set(-2.2 * beat, 0.15, 0.6 + beat * 0.3 * T);
			targets.leftArm.rot.set(-0.5, -0.15, -0.4);
			targets.rightArm.pos.y = 1.5 + beat * 0.15 * T;
			targets.head.rot.y = -sway * 0.25 * T;
			targets.head.rot.z = -Math.sin(t * 3.2) * 0.1 * T;
			targets.leftLeg.rot.x = -Math.sin(p * Math.PI * 2) * 0.4 * T;
			targets.rightLeg.rot.x = Math.sin(p * Math.PI * 2) * 0.4 * T;
		} else {
			// Both arms up — party mode!
			const wave = Math.sin(t * 4);
			targets.leftArm.rot.set(-2.5, -0.2 + wave * 0.15 * T, -0.8);
			targets.rightArm.rot.set(-2.5, 0.2 - wave * 0.15 * T, 0.8);
			targets.leftArm.pos.y = 1.6 + beat * 0.1 * T;
			targets.rightArm.pos.y = 1.6 + beat * 0.1 * T;
			targets.head.rot.y = wave * 0.2 * T;
			targets.head.rot.z = wave * 0.1 * T;
			// Marching legs
			targets.leftLeg.rot.x = Math.sin(t * 6.4) * 0.35 * T;
			targets.rightLeg.rot.x = -Math.sin(t * 6.4) * 0.35 * T;
		}
	}
};
