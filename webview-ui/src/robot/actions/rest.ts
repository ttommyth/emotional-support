import type { RobotActionDefinition } from '../types';

export const rest: RobotActionDefinition = {
	name: 'rest',
	tags: ['idleFiller', 'idleLike', 'restPose'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		// Relaxed standing rest — arms hang loose with a gentle sway,
		// body lowered slightly, head calm.
		const sway = Math.sin(t * 0.6) * 0.04;
		const breathe = Math.sin(t * 1.0) * 0.05;

		targets.body.pos.y = -0.12 + breathe;
		targets.body.rot.x = 0.05 + sway;
		targets.body.rot.z = Math.sin(t * 0.45) * 0.02;

		// Arms hang naturally, slightly forward, gentle inward sway
		targets.leftArm.rot.set(-0.35 + Math.sin(t * 0.7) * 0.05, 0.12, -0.2);
		targets.rightArm.rot.set(-0.35 - Math.sin(t * 0.7) * 0.05, -0.12, 0.2);

		// Head relaxed, slight droop and slow look-around
		targets.head.rot.x = 0.18 + Math.sin(t * 0.5) * 0.06;
		targets.head.rot.y = Math.sin(t * 0.38) * 0.2;
		targets.head.rot.z = Math.sin(t * 0.55) * 0.03;

		// Weight shift, knees slightly bent
		targets.leftLeg.rot.x = -0.15;
		targets.rightLeg.rot.x = -0.1 + Math.sin(t * 0.3) * 0.04;
	}
};
