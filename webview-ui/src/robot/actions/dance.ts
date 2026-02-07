import type { RobotActionDefinition } from '../types';

export const dance: RobotActionDefinition = {
	name: 'dance',
	tags: ['idleFiller'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		const phase = t % 6;
		const beat = Math.abs(Math.sin(t * 3.2));
		const sway = Math.sin(t * 1.6);

		// Core bounce — on every beat
		targets.body.pos.y = beat * 0.22;
		targets.body.pos.x = sway * 0.4;
		targets.body.rot.z = sway * 0.12;

		if (phase < 2) {
			// Disco arms — alternating up/down
			const p = phase / 2;
			targets.leftArm.rot.set(-2.2 * beat, -0.15, -0.6 - beat * 0.3);
			targets.rightArm.rot.set(-0.5, 0.15, 0.4);
			targets.leftArm.pos.y = 1.5 + beat * 0.15;
			targets.head.rot.y = sway * 0.25;
			targets.head.rot.z = Math.sin(t * 3.2) * 0.1;
			targets.leftLeg.rot.x = Math.sin(p * Math.PI * 2) * 0.4;
			targets.rightLeg.rot.x = -Math.sin(p * Math.PI * 2) * 0.4;
		} else if (phase < 4) {
			// Switch arms — other side
			const p = (phase - 2) / 2;
			targets.rightArm.rot.set(-2.2 * beat, 0.15, 0.6 + beat * 0.3);
			targets.leftArm.rot.set(-0.5, -0.15, -0.4);
			targets.rightArm.pos.y = 1.5 + beat * 0.15;
			targets.head.rot.y = -sway * 0.25;
			targets.head.rot.z = -Math.sin(t * 3.2) * 0.1;
			targets.leftLeg.rot.x = -Math.sin(p * Math.PI * 2) * 0.4;
			targets.rightLeg.rot.x = Math.sin(p * Math.PI * 2) * 0.4;
		} else {
			// Both arms up — party mode!
			const wave = Math.sin(t * 4);
			targets.leftArm.rot.set(-2.5, -0.2 + wave * 0.15, -0.8);
			targets.rightArm.rot.set(-2.5, 0.2 - wave * 0.15, 0.8);
			targets.leftArm.pos.y = 1.6 + beat * 0.1;
			targets.rightArm.pos.y = 1.6 + beat * 0.1;
			targets.head.rot.y = wave * 0.2;
			targets.head.rot.z = wave * 0.1;
			// Marching legs
			targets.leftLeg.rot.x = Math.sin(t * 6.4) * 0.35;
			targets.rightLeg.rot.x = -Math.sin(t * 6.4) * 0.35;
		}
	}
};
