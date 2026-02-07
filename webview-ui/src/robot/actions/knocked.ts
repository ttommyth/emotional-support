import type { RobotActionDefinition } from '../types';

export const knocked: RobotActionDefinition = {
	name: 'knocked',
	tags: ['blocksAutoLookAt'],
	eyeColor: 'purple',
	apply: (t, { targets }) => {
		// Wobbly stagger — dizzy swaying with occasional stumble
		const dizzy = Math.sin(t * 2.2) * 0.5 + Math.sin(t * 3.7) * 0.25;
		const stumble = Math.sin(t * 1.3) * 0.3;

		targets.body.pos.x = dizzy * 0.6;
		targets.body.pos.y = Math.abs(Math.sin(t * 4.5)) * 0.3;
		targets.body.rot.z = dizzy * 0.35;
		targets.body.rot.x = stumble * 0.15;

		// Head lolls around — dizzy circle
		targets.head.rot.x = -0.15 + Math.sin(t * 2.8) * 0.2;
		targets.head.rot.y = Math.cos(t * 2.1) * 0.4;
		targets.head.rot.z = Math.sin(t * 1.9) * 0.25;

		// Arms hang loose, swinging with body momentum
		targets.leftArm.rot.set(
			Math.sin(t * 1.5) * 0.3,
			0,
			-0.6 + dizzy * 0.4
		);
		targets.rightArm.rot.set(
			Math.cos(t * 1.5) * 0.3,
			0,
			0.6 - dizzy * 0.4
		);

		// Stumbling legs
		targets.leftLeg.rot.x = Math.sin(t * 3) * 0.2 + stumble * 0.2;
		targets.rightLeg.rot.x = Math.cos(t * 3) * 0.2 - stumble * 0.2;
	}
};
