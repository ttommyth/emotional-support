import * as THREE from 'three';
import type { RobotActionDefinition } from '../types';
import { createPoseTransitions } from './helpers';

const transitions = createPoseTransitions(
	(eased, _t, { targets }) => {
		targets.body.pos.y = -0.5 * eased;
		targets.head.rot.set(0.5 * eased, 0.2 * eased, 0.1 * eased);
		targets.leftArm.rot.set(0, 0, 0);
		targets.rightArm.rot.set(0, 0, 0);
	},
	0.9,
	1.1
);

export const sleep: RobotActionDefinition = {
	name: 'sleep',
	tags: ['idleFiller', 'sleep', 'blocksAutoLookAt', 'blocksBlink'],
	eyeColor: 'off',
	pre: transitions.pre,
	apply: (t, { targets }) => {
		targets.body.pos.y = -0.5 + Math.sin(t) * 0.05;
		targets.head.rot.set(0.5, 0.2, 0.1);
		targets.leftArm.rot.set(0, 0, 0);
		targets.rightArm.rot.set(0, 0, 0);
	},
	post: transitions.post,
	update: (_delta, time, { props, headGroup }) => {
		props.zParticles.forEach((z, i) => {
			const headWorldPos = new THREE.Vector3();
			headGroup.getWorldPosition(headWorldPos);
			const l = (time + i) % 3;
			z.mesh.position.set(headWorldPos.x + 1, headWorldPos.y + 1 + l * 1.5, headWorldPos.z);
			z.mesh.position.x += Math.sin(l * 5) * 0.5;
			const opacity = l < 0.5 ? l * 2 : l > 2.0 ? 1 - (l - 2) : 1;
			(z.mesh.material as THREE.SpriteMaterial).opacity = opacity;
			z.mesh.visible = opacity > 0.01;
		});
	}
};
