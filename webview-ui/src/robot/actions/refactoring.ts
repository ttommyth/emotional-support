import * as THREE from 'three';
import { defineAction, smoothStep } from './helpers';

export const refactoring = defineAction({
	name: 'refactoring',
	tags: ['work'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		// Swings the wrench (held pointing skyward) up and down onto the work.
		// The raise stays low enough that the tool stays in front of the head.
		const phase = t % 2.4;

		// Left hand steadies the workpiece in front
		targets.leftArm.rot.set(-0.9, 0.35, 0.25);
		targets.leftArm.pos.y = 1.5;

		let rightX: number;
		let bodyX: number;
		if (phase < 0.5) {
			// Raise the wrench up a bit
			const p = smoothStep(phase / 0.5);
			rightX = -1.5 - p * 0.2;   // -1.5 → -1.7
			bodyX = -0.03 * p;
		} else if (phase < 0.9) {
			// Strike down
			const p = smoothStep((phase - 0.5) / 0.4);
			rightX = -1.7 + p * 0.9;   // -1.7 → -0.8
			bodyX = -0.03 + p * 0.12;
		} else {
			// Recover — settle + recoil
			const p = (phase - 0.9) / 1.5;
			rightX = -0.8 + Math.sin(p * Math.PI) * 0.08;
			bodyX = 0.09 - p * 0.04;
		}

		targets.rightArm.rot.set(rightX, -0.12, -0.1);
		targets.rightArm.pos.y = 1.5;

		// Head watches the strike point
		targets.head.rot.set(0.28, 0.18, Math.sin(t * 1.4) * 0.04);

		// Body: strike recoil + breathing
		targets.body.rot.x = bodyX;
		targets.body.rot.z = Math.sin(t * 1.1) * 0.02;
		targets.body.pos.y = Math.sin(t * 1.3) * 0.04;
	},
	prop: {
		attachToArm: 'right',
		anchor: { position: [0, -2.2, 0], rotation: [Math.PI / 2, 0, 0] },
		buildMesh: () => {
			const matMetal = new THREE.MeshStandardMaterial({ color: 0xb2bec3, metalness: 0.8, roughness: 0.3 });
			const matGrip = new THREE.MeshStandardMaterial({ color: 0xff9f43, roughness: 0.6 });

			// Wrench held pointing skyward: vertical handle in the fist, ring
			// head at the top facing the camera. Ring clears the hand sphere.
			const wrench = new THREE.Group();
			// grip — in the fist
			const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.8, 12), matGrip);
			grip.position.y = -0.35;
			grip.castShadow = true;
			wrench.add(grip);
			// shaft — from the fist up to the head
			const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.8, 12), matMetal);
			shaft.position.y = 0.45;
			shaft.castShadow = true;
			wrench.add(shaft);
			// head — big ring at the top, facing the camera
			const head = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.11, 12, 20), matMetal);
			head.position.y = 1.3;
			head.castShadow = true;
			wrench.add(head);

			return wrench;
		}
	}
});
