import type { RobotActionDefinition } from '../types';

export const lookaround: RobotActionDefinition = {
	name: 'lookaround',
	tags: ['idleLike', 'idleFiller'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		const phase = t % 6;

		if (phase < 2) {
			// Look left — body follows slightly
			const p = phase / 2;
			const e = p * p * (3 - 2 * p);
			targets.head.rot.y = -0.5 * e;
			targets.head.rot.x = 0.05 + Math.sin(p * Math.PI) * 0.08;
			targets.body.rot.y = -0.08 * e;
			targets.body.rot.z = -0.03 * e;
		} else if (phase < 3.5) {
			// Sweep right past center — curious
			const p = (phase - 2) / 1.5;
			const e = p * p * (3 - 2 * p);
			targets.head.rot.y = -0.5 + e * 1.0;
			targets.head.rot.x = 0.05;
			targets.body.rot.y = -0.08 + e * 0.16;
			targets.body.rot.z = -0.03 + e * 0.06;
		} else if (phase < 5) {
			// Hold right — spotted something
			const p = (phase - 3.5) / 1.5;
			targets.head.rot.y = 0.5;
			targets.head.rot.x = 0.05 - Math.sin(p * Math.PI) * 0.06;
			targets.head.rot.z = -Math.sin(p * Math.PI) * 0.06;
			targets.body.rot.y = 0.08;
			targets.body.rot.z = 0.03;
			// Hand to visor — shielding eyes
			const handUp = Math.sin(p * Math.PI);
			targets.rightArm.rot.set(-1.8 * handUp, 0.3 * handUp, 0.4 * handUp);
			targets.rightArm.pos.y = 1.5 + handUp * 0.2;
		} else {
			// Return to center
			const p = (phase - 5) / 1;
			const e = p * p * (3 - 2 * p);
			targets.head.rot.y = 0.5 * (1 - e);
			targets.head.rot.x = 0.05;
			targets.body.rot.y = 0.08 * (1 - e);
			targets.body.rot.z = 0.03 * (1 - e);
		}

		// Idle arm sway for arms not doing visor gesture
		targets.leftArm.rot.set(Math.sin(t * 0.9) * 0.08, -0.12, -0.15);
		if (phase < 3.5 || phase >= 5) {
			targets.rightArm.rot.set(Math.sin(t * 0.9 + 1) * 0.08, 0.12, 0.15);
		}

		targets.body.pos.y = Math.sin(t * 1.3) * 0.05;
	}
};
