import type { RobotActionDefinition } from '../types';

export const wave: RobotActionDefinition = {
	name: 'wave',
	tags: ['idleFiller'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		const phase = t % 4.0;

		// Right arm: raise → wave back and forth → lower
		targets.rightArm.pos.y = 1.5;
		if (phase < 0.7) {
			// Raise arm
			const p = phase / 0.7;
			const e = p * p * (3 - 2 * p);
			targets.rightArm.rot.set(-0.3 * e, 0.2 * e, 0.4 + e * 2.0);
		} else if (phase < 3.0) {
			// Wave — big forearm swings
			const p = phase - 0.7;
			targets.rightArm.rot.set(
				Math.sin(p * 7) * 0.35,
				0.2,
				2.4 + Math.sin(p * 7) * 0.2
			);
		} else {
			// Lower arm
			const p = (phase - 3.0) / 1.0;
			const e = p * p * (3 - 2 * p);
			targets.rightArm.rot.set(
				-0.3 * (1 - e),
				0.2 * (1 - e),
				2.4 - e * 2.0
			);
		}

		// Left arm: gentle idle sway
		targets.leftArm.rot.set(Math.sin(t * 1.2) * 0.08, -0.12, -0.2);

		// Body leans toward waving side
		targets.body.rot.z = phase < 3.0 ? -0.06 : -0.06 * (1 - (phase - 3.0));
		targets.body.pos.y = Math.sin(t * 1.8) * 0.06;

		// Head: friendly tilt and nod
		targets.head.rot.y = Math.sin(t * 1.4) * 0.12;
		targets.head.rot.z = phase < 3.0 ? Math.sin(t * 2.5) * 0.1 : 0;
		targets.head.rot.x = Math.sin(t * 1.8) * 0.06;
	}
};
