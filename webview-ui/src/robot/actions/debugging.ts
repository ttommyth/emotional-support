import * as THREE from 'three';
import { defineAction, ANCHOR_PRESETS } from './helpers';

export const debugging = defineAction({
	name: 'debugging',
	tags: ['work'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		const phase = t % 5;

		// Left arm holds steady
		targets.leftArm.rot.set(-0.9, 0.1, 0.25);

		// Lean in — examining closely
		targets.body.rot.x = 0.06 + Math.sin(t * 0.8) * 0.02;
		targets.body.pos.y = Math.sin(t * 1.1) * 0.04;
		targets.body.rot.z = Math.sin(t * 0.7) * 0.03;

		if (phase < 2) {
			// Scanning left-to-right with magnifying glass
			const p = phase / 2;
			targets.head.rot.x = -0.1;
			targets.head.rot.y = -0.3 + p * 0.6;
			targets.head.rot.z = Math.sin(p * Math.PI) * 0.05;
			targets.rightArm.rot.set(-0.85, 0.1 + p * 0.15, 0.6 + p * 0.2);
		} else if (phase < 3.5) {
			// Found something! — zoom in, head tilts
			const p = (phase - 2) / 1.5;
			targets.head.rot.x = -0.1 - p * 0.08;
			targets.head.rot.y = 0.3 - p * 0.15;
			targets.head.rot.z = -0.06 * Math.sin(p * Math.PI);
			targets.rightArm.rot.set(-0.85 + Math.sin(p * 6) * 0.08, 0.25, 0.8);
			targets.body.rot.x = 0.06 + p * 0.04;
		} else {
			// Pull back, think about it
			const p = (phase - 3.5) / 1.5;
			targets.head.rot.x = -0.18 + p * 0.1;
			targets.head.rot.y = 0.15 - p * 0.45;
			targets.rightArm.rot.set(-0.85, 0.25 - p * 0.15, 0.8 - p * 0.2);
			targets.body.rot.x = 0.1 - p * 0.04;
		}
	},
	prop: {
		anchor: { ...ANCHOR_PRESETS.rightHand },
		buildMesh: () => {
			const matRing = new THREE.MeshStandardMaterial({ color: 0x636e72, metalness: 0.7, roughness: 0.3 });
			const matGlass = new THREE.MeshStandardMaterial({ color: 0xa3d8ff, transparent: true, opacity: 0.7 });
			const matHandle = new THREE.MeshStandardMaterial({ color: 0x2d3436, metalness: 0.5, roughness: 0.5 });

			const glass = new THREE.Group();
			const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.08, 12, 20), matRing);
			ring.castShadow = true;
			glass.add(ring);
			const lens = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), matGlass);
			lens.position.z = 0.02;
			glass.add(lens);
			const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 10), matHandle);
			handle.position.set(0.4, -0.7, 0);
			handle.rotation.z = Math.PI / 4;
			handle.castShadow = true;
			glass.add(handle);

			return glass;
		},
		heldUpdate: (mesh, time) => {
			mesh.rotation.z = Math.sin(time * 2) * 0.2;
			mesh.position.y += Math.sin(time * 3) * 0.01;
		}
	}
});
