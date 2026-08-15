import * as THREE from 'three';
import { defineAction, temp } from './helpers';

export const debugging = defineAction({
	name: 'debugging',
	tags: ['work'],
	eyeColor: 'cyan',
	apply: (t, ctx) => {
		const { targets } = ctx;
		const T = temp(ctx);

		const phase = t % 5;

		// Both hands hold the big lens up in front, near its rim
		targets.leftArm.rot.set(-1.4, 0.5, 0.22);
		targets.rightArm.rot.set(-1.4, -0.5, -0.22);
		targets.leftArm.pos.y = 1.5;
		targets.rightArm.pos.y = 1.5;

		// Lean in — examining closely
		targets.body.rot.x = 0.08 + Math.sin(t * 0.8) * 0.02 * T;
		targets.body.pos.y = Math.sin(t * 1.1) * 0.04 * T;
		targets.body.rot.z = Math.sin(t * 0.7) * 0.03 * T;

		if (phase < 2) {
			// Scanning across the lens — head looks down at it, small sweep
			const p = phase / 2;
			targets.head.rot.x = 0.3 + Math.sin(p * Math.PI) * 0.05 * T;
			targets.head.rot.y = -0.15 + p * 0.3;
			targets.head.rot.z = Math.sin(p * Math.PI) * 0.04 * T;
		} else if (phase < 3.5) {
			// Found something — lean in closer
			const p = (phase - 2) / 1.5;
			targets.head.rot.x = 0.3 - p * 0.07 * T;
			targets.head.rot.y = 0.15 - p * 0.1;
			targets.head.rot.z = -0.05 * Math.sin(p * Math.PI) * T;
			targets.body.rot.x = 0.08 + p * 0.05;
		} else {
			// Pull back, think about it
			const p = (phase - 3.5) / 1.5;
			targets.head.rot.x = 0.23 + p * 0.08;
			targets.head.rot.y = 0.05 - p * 0.2;
			targets.body.rot.x = 0.13 - p * 0.05;
		}
	},
	prop: {
		anchor: { position: [0, 0.6, 3.0], rotation: [0.12, 0, 0] },
		buildMesh: () => {
			const matRing = new THREE.MeshStandardMaterial({ color: 0x636e72, metalness: 0.7, roughness: 0.3 });
			const matGlass = new THREE.MeshStandardMaterial({ color: 0xa3d8ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
			const matHandle = new THREE.MeshStandardMaterial({ color: 0x2d3436, metalness: 0.5, roughness: 0.5 });

			// Big round magnifier held up in front, ring/lens facing the camera.
			const glass = new THREE.Group();
			const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.12, 16, 32), matRing);
			ring.castShadow = true;
			glass.add(ring);
			const lens = new THREE.Mesh(new THREE.CircleGeometry(0.92, 32), matGlass);
			lens.position.z = 0.03;
			glass.add(lens);
			// short handle below the rim
			const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.8, 12), matHandle);
			handle.position.y = -1.15;
			handle.castShadow = true;
			glass.add(handle);
			const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), matHandle);
			pommel.position.y = -1.6;
			glass.add(pommel);

			return glass;
		}
	}
});
