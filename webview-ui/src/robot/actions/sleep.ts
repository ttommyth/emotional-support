import * as THREE from 'three';
import type { RobotActionDefinition } from '../types';
import type { RobotProps } from './props';

export const sleep: RobotActionDefinition = {
	name: 'sleep',
	tags: ['idleFiller', 'sleep', 'blocksAutoLookAt', 'blocksBlink'],
	eyeColor: 'off',
	pre: {
		duration: 0.9,
		apply: (p, _t, { targets }) => {
			const eased = p * p * (3 - 2 * p);
			targets.body.pos.y = -0.5 * eased;
			targets.head.rot.set(0.5 * eased, 0.2 * eased, 0.1 * eased);
			targets.leftArm.rot.set(0, 0, 0);
			targets.rightArm.rot.set(0, 0, 0);
		}
	},
	apply: (t, { targets }) => {
		targets.body.pos.y = -0.5 + Math.sin(t) * 0.05;
		targets.head.rot.set(0.5, 0.2, 0.1);
		targets.leftArm.rot.set(0, 0, 0);
		targets.rightArm.rot.set(0, 0, 0);
	},
	post: {
		duration: 1.1,
		apply: (p, _t, { targets }) => {
			const eased = p * p * p * (p * (6 * p - 15) + 10);
			targets.body.pos.y = -0.5 * (1 - eased);
			targets.head.rot.set(0.5 * (1 - eased), 0.2 * (1 - eased), 0.1 * (1 - eased));
			targets.leftArm.rot.set(0, 0, 0);
			targets.rightArm.rot.set(0, 0, 0);
		}
	},
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

export function createSleepParticles(scene: THREE.Scene): RobotProps['zParticles'] {
	const zParticles: RobotProps['zParticles'] = [];
	for (let i = 0; i < 3; i++) {
		const c = document.createElement('canvas');
		c.width = 64;
		c.height = 64;
		const ctx = c.getContext('2d');
		if (ctx) {
			ctx.fillStyle = 'white';
			ctx.font = 'bold 50px sans-serif';
			ctx.fillText('Z', 10, 50);
		}
		const zSprite = new THREE.Sprite(
			new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0 })
		);
		zSprite.scale.set(1.5, 1.5, 1.5);
		scene.add(zSprite);
		zParticles.push({ mesh: zSprite, offset: i * 2 });
	}
	return zParticles;
}
