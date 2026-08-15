import type { RobotActionDefinition } from '../types';

export const shrug: RobotActionDefinition = {
	name: 'shrug',
	tags: ['idleLike', 'idleFiller'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		const phase = t % 3;
		const smooth = (p: number) => p * p * (3 - 2 * p);
		// Shoulder-up intensity 0..1: raise (1s), hold (1s), lower (1s)
		let u: number;
		if (phase < 1) {
			u = smooth(phase);
		} else if (phase < 2) {
			u = 1;
		} else {
			u = 1 - smooth(phase - 2);
		}

		// Shoulders rise; arms hang with hands turned slightly out & forward
		targets.leftArm.pos.y = 1.5 + u * 0.35;
		targets.rightArm.pos.y = 1.5 + u * 0.35;
		targets.leftArm.rot.set(-0.2 * u, 0.15 * u, -0.35 * u);
		targets.rightArm.rot.set(-0.2 * u, -0.15 * u, 0.35 * u);

		// Head: slight tilt, a touch of "well?"
		targets.head.rot.x = -0.06 * u;
		targets.head.rot.y = Math.sin(t * 0.7) * 0.05;
		targets.head.rot.z = -Math.sin(t * 0.9) * 0.03;
	}
};
