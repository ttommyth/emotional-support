import * as THREE from 'three';
import type { RobotActionDefinition } from '../types';
import type { RobotProps } from './props';

export const sleep: RobotActionDefinition = {
	name: 'sleep',
	apply: (t, { targets }) => {
		targets.body.pos.y = -0.5 + Math.sin(t) * 0.05;
		targets.head.rot.set(0.5, 0.2, 0.1);
		targets.leftArm.rot.set(0, 0, 0);
		targets.rightArm.rot.set(0, 0, 0);
	},
	update: (_delta, time, { props, headGroup }) => {
		props.zParticles.forEach((z, i) => {
			z.mesh.visible = true;
			const headWorldPos = new THREE.Vector3();
			headGroup.getWorldPosition(headWorldPos);
			const l = (time + i) % 3;
			z.mesh.position.set(headWorldPos.x + 1, headWorldPos.y + 1 + l * 1.5, headWorldPos.z);
			z.mesh.position.x += Math.sin(l * 5) * 0.5;
			(z.mesh.material as THREE.SpriteMaterial).opacity =
				l < 0.5 ? l * 2 : l > 2.0 ? 1 - (l - 2) : 1;
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
