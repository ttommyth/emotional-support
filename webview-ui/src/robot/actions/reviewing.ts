import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry';
import { defineAction } from './helpers';

export const reviewing = defineAction({
	name: 'reviewing',
	tags: ['work'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		const phase = t % 5;

		// Arms hold clipboard
		targets.leftArm.rot.set(-0.9, 0.05, 0.35);
		targets.rightArm.rot.set(-0.85, -0.05, -0.35);

		if (phase < 2.5) {
			// Scanning section — head moves down through checklist
			const p = phase / 2.5;
			targets.head.rot.x = 0.1 + p * 0.1;
			targets.head.rot.y = -0.2 + p * 0.4;
			targets.body.rot.z = -0.02 + p * 0.04;
		} else if (phase < 3.5) {
			// Considering — slight head tilt, eyebrow raise
			const p = phase - 2.5;
			targets.head.rot.x = 0.2 - Math.sin(p * Math.PI) * 0.08;
			targets.head.rot.y = 0.2;
			targets.head.rot.z = Math.sin(p * Math.PI) * 0.06;
			targets.body.rot.z = 0.02;
			// Right hand lifts slightly (marking/checking)
			targets.rightArm.rot.x = -0.85 - Math.sin(p * Math.PI) * 0.15;
			targets.rightArm.pos.y = 1.5 + Math.sin(p * Math.PI) * 0.08;
		} else {
			// Return sweep
			const p = (phase - 3.5) / 1.5;
			targets.head.rot.x = 0.2 - p * 0.1;
			targets.head.rot.y = 0.2 - p * 0.4;
			targets.body.rot.z = 0.02 - p * 0.04;
		}

		// Breathing / gentle body movement
		targets.body.pos.y = Math.sin(t * 1.2) * 0.04;
		targets.body.rot.x = 0.03 + Math.sin(t * 0.9) * 0.02;
	},
	prop: {
		anchor: { position: [0.2, 0.9, 3.2], rotation: [0.15, Math.PI, 0] },
		buildMesh: () => {
			const matPaper = new THREE.MeshLambertMaterial({ color: 0xfdfdfd });
			const matClip = new THREE.MeshLambertMaterial({ color: 0x636e72 });
			const matCheck = new THREE.MeshBasicMaterial({ color: 0x00b894 });

			const clipboard = new THREE.Group();
			const board = new THREE.Mesh(new RoundedBoxGeometry(2.4, 3, 0.08, 2, 0.05), matPaper);
			board.castShadow = true;
			clipboard.add(board);

			const clip = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.2, 0.2, 2, 0.05), matClip);
			clip.position.set(0, 1.5, 0.08);
			clipboard.add(clip);

			for (let i = 0; i < 3; i++) {
				const check = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.25), matCheck);
				check.position.set(-0.8, 0.8 - i * 0.7, 0.09);
				clipboard.add(check);
			}

			return clipboard;
		},
		heldUpdate: (mesh, time) => {
			mesh.rotation.z = Math.sin(time * 1.5) * 0.1;
		}
	}
});
