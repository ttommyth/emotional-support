import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry';
import { defineAction } from './helpers';

export const coding = defineAction({
	name: 'coding',
	tags: ['work'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		// Typing rhythm — alternating hands with pauses
		const cycle = t % 2.5;
		const typing = cycle < 2.0; // type for 2s, brief pause 0.5s
		const jL = typing ? Math.sin(t * 12) * 0.08 : 0;
		const jR = typing ? Math.cos(t * 12 + 0.5) * 0.08 : 0;

		targets.leftArm.rot.set(-1.4 + jL * 0.3, 0.1, 0.25);
		targets.rightArm.rot.set(-1.4 + jR * 0.3, -0.1, -0.25);
		targets.leftArm.pos.y = 1.5 + jL;
		targets.rightArm.pos.y = 1.5 + jR;

		// Lean in toward screen, slight sway
		targets.body.pos.y = Math.sin(t * 1.5) * 0.04;
		targets.body.rot.x = 0.05;
		targets.body.rot.z = Math.sin(t * 0.8) * 0.02;

		// Head tracks code — small vertical scanning + occasional side glance
		targets.head.rot.x = 0.18 + Math.sin(t * 2) * 0.06;
		targets.head.rot.y = Math.sin(t * 0.7) * 0.12;
	},
	prop: {
		anchor: { position: [0, 0.5, 3.2], rotation: [-0.3, Math.PI, 0] },
		buildMesh: () => {
			const matBody = new THREE.MeshLambertMaterial({ color: 0x636e72 });
			const matScreen = new THREE.MeshBasicMaterial({ color: 0x74b9ff });

			const laptop = new THREE.Group();
			const base = new THREE.Mesh(new RoundedBoxGeometry(3, 0.2, 2.2, 2, 0.05), matBody);
			base.castShadow = true;
			laptop.add(base);
			const screenPivot = new THREE.Group();
			screenPivot.position.set(0, 0.12, -1.0);
			laptop.add(screenPivot);
			const screen = new THREE.Mesh(new RoundedBoxGeometry(3, 2, 0.2, 2, 0.05), matBody);
			screen.position.set(0, 1, 0);
			screen.castShadow = true;
			screenPivot.add(screen);
			const display = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), matScreen);
			display.position.set(0, 1, 0.11);
			screenPivot.add(display);
			screenPivot.rotation.x = -0.75;

			return laptop;
		}
	}
});
