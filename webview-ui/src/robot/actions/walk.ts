import type { RobotActionDefinition } from '../types';

export const walk: RobotActionDefinition = {
	name: 'walk',
	tags: ['blocksAutoLookAt', 'skipPost', 'movement'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		const speed = 8;
		const stride = Math.sin(t * speed);
		const lift = Math.abs(stride);

		// Body: vertical bounce + slight lean forward + hip sway
		targets.body.pos.y = lift * 0.22;
		targets.body.rot.x = 0.04;
		targets.body.rot.z = Math.sin(t * speed * 0.5) * 0.06;

		// Legs: asymmetric stride — forward leg bends more
		targets.leftLeg.rot.x = stride * 0.7;
		targets.rightLeg.rot.x = -stride * 0.7;

		// Arms: natural counter-swing with slight bend
		targets.leftArm.rot.x = -stride * 0.5;
		targets.rightArm.rot.x = stride * 0.5;
		targets.leftArm.rot.z = -0.15 + lift * 0.05;
		targets.rightArm.rot.z = 0.15 - lift * 0.05;

		// Head: gentle bob and slight look sway
		targets.head.rot.x = -0.05 + lift * 0.06;
		targets.head.rot.y = Math.sin(t * speed * 0.5) * 0.08;
	}
};
