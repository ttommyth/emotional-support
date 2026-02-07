import * as THREE from 'three';
import { defineAction, ANCHOR_PRESETS } from './helpers';

export const refactoring = defineAction({
	name: 'refactoring',
	tags: ['work'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		const phase = t % 3.0;

		// Left arm holds the part (steady)
		targets.leftArm.rot.set(-1.1, 0.15, 0.3);

		if (phase < 1.2) {
			// Examining — turn piece, study it
			const p = phase / 1.2;
			targets.rightArm.rot.set(-0.8, -0.2, -0.4);
			targets.head.rot.y = -0.15 + p * 0.3;
			targets.head.rot.x = 0.08;
			targets.body.rot.z = Math.sin(p * Math.PI) * 0.03;
		} else if (phase < 2.2) {
			// Working — wrench action, tightening/loosening
			const p = phase - 1.2;
			targets.rightArm.rot.set(
				-0.9 + Math.sin(p * 8) * 0.15,
				-0.15 + Math.sin(p * 8) * 0.1,
				-0.5
			);
			targets.head.rot.y = 0.15;
			targets.head.rot.x = 0.12 + Math.sin(p * 6) * 0.03;
			targets.body.rot.x = 0.04;
			targets.body.pos.y = Math.sin(p * 8) * 0.03;
		} else {
			// Check result — lean back slightly
			const p = (phase - 2.2) / 0.8;
			targets.rightArm.rot.set(-0.7, -0.1, -0.3);
			targets.head.rot.y = Math.sin(p * Math.PI) * 0.15;
			targets.head.rot.x = 0.05 - p * 0.05;
			targets.body.rot.x = 0.04 - p * 0.04;
		}

		targets.body.rot.z = Math.sin(t * 0.8) * 0.03;
	},
	prop: {
		anchor: { ...ANCHOR_PRESETS.leftHand },
		buildMesh: () => {
			const matMetal = new THREE.MeshStandardMaterial({ color: 0xb2bec3, metalness: 0.8, roughness: 0.3 });
			const matHandle = new THREE.MeshStandardMaterial({ color: 0x2d3436, metalness: 0.4, roughness: 0.6 });

			const wrench = new THREE.Group();
			const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 12), matHandle);
			handle.rotation.z = Math.PI / 2;
			const head = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.08, 12, 18, Math.PI), matMetal);
			head.position.set(0.8, 0, 0);
			head.rotation.z = Math.PI / 2;
			const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), matMetal);
			jaw.position.set(0.95, 0.12, 0);

			wrench.add(handle);
			wrench.add(head);
			wrench.add(jaw);
			wrench.castShadow = true;

			return wrench;
		},
		heldUpdate: (mesh, time) => {
			mesh.rotation.x = Math.sin(time * 2) * 0.2;
			mesh.rotation.z = Math.sin(time * 1.5) * 0.2;
		}
	}
});
