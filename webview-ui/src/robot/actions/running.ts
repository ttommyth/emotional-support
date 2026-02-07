import type { RobotActionDefinition } from '../types';

export const running: RobotActionDefinition = {
	name: 'running',
	tags: ['blocksAutoLookAt', 'skipPost', 'movement'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		const speed = 14;
		const stride = Math.sin(t * speed);
		const lift = Math.abs(stride);

		// Body: bigger bounce, lean forward, hip twist
		targets.body.pos.y = lift * 0.5;
		targets.body.rot.x = 0.12;
		targets.body.rot.z = Math.sin(t * speed * 0.5) * 0.08;
		targets.body.rot.y = Math.sin(t * speed * 0.5) * 0.04;

		// Legs: high knees, exaggerated stride
		targets.leftLeg.rot.x = stride * 1.1;
		targets.rightLeg.rot.x = -stride * 1.1;

		// Arms: big pumps, elbows bent
		targets.leftArm.rot.x = -stride * 1.2;
		targets.rightArm.rot.x = stride * 1.2;
		targets.leftArm.rot.z = -0.25;
		targets.rightArm.rot.z = 0.25;
		targets.leftArm.rot.y = stride * 0.15;
		targets.rightArm.rot.y = -stride * 0.15;

		// Head: determined look with slight bob
		targets.head.rot.x = -0.08 + lift * 0.08;
		targets.head.rot.y = Math.sin(t * 1.5) * 0.06;
	}
};
