import * as THREE from 'three';
import { defineAction } from './helpers';

export const testing = defineAction({
	name: 'testing',
	tags: ['work'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		const phase = t % 5;

		// Arms hold test rack steady
		targets.leftArm.rot.set(-1.1, 0.08, 0.22);
		targets.rightArm.rot.set(-1.1, -0.08, -0.22);

		if (phase < 2.0) {
			// Running tests — watching intently, slight lean forward
			const p = phase / 2.0;
			targets.head.rot.x = 0.15 + Math.sin(p * Math.PI * 2) * 0.04;
			targets.head.rot.y = Math.sin(p * Math.PI) * 0.08;
			targets.body.rot.x = 0.06;
			targets.body.pos.y = Math.sin(t * 1.5) * 0.03;
			// One hand adjusts test tube
			targets.rightArm.rot.x = -1.1 + Math.sin(p * Math.PI) * 0.15;
		} else if (phase < 3.0) {
			// Waiting — leaning back, anticipation
			const p = phase - 2.0;
			targets.head.rot.x = 0.1 - p * 0.1;
			targets.head.rot.y = p * 0.1;
			targets.body.rot.x = 0.06 - p * 0.06;
			targets.body.pos.y = -0.05 * p;
			// Tapping foot
			targets.rightLeg.rot.x = Math.sin(t * 6) * 0.12;
		} else if (phase < 4.0) {
			// Results coming — lean in eagerly
			const p = phase - 3.0;
			targets.head.rot.x = 0.1 + p * 0.1;
			targets.head.rot.y = -0.05;
			targets.body.rot.x = p * 0.08;
			targets.body.pos.y = p * 0.06;
		} else {
			// Small satisfied/concerned reaction
			const p = phase - 4.0;
			targets.head.rot.x = 0.2 - p * 0.1;
			targets.head.rot.y = Math.sin(p * Math.PI * 2) * 0.1;
			targets.body.rot.x = 0.08 - p * 0.04;
			targets.body.pos.y = 0.06 * Math.cos(p * Math.PI);
		}
	},
	prop: {
		anchor: { position: [0, 0.7, 3.1], rotation: [0.15, Math.PI, 0] },
		buildMesh: () => {
			const matGlass = new THREE.MeshStandardMaterial({ color: 0x81ecec, transparent: true, opacity: 0.7 });
			const matFluid = new THREE.MeshStandardMaterial({ color: 0x74b9ff, emissive: 0x74b9ff, emissiveIntensity: 0.2 });
			const matRack = new THREE.MeshStandardMaterial({ color: 0x636e72, metalness: 0.6, roughness: 0.4 });

			const rack = new THREE.Group();
			const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 0.8), matRack);
			base.castShadow = true;
			base.position.y = -0.1;
			rack.add(base);

			for (let i = 0; i < 3; i++) {
				const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 16), matGlass);
				tube.position.set(-0.6 + i * 0.6, 0.6, 0);
				tube.castShadow = true;
				rack.add(tube);
				const fluid = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 16), matFluid);
				fluid.position.set(-0.6 + i * 0.6, 0.35, 0);
				rack.add(fluid);
			}

			return rack;
		},
		heldUpdate: (mesh, time) => {
			mesh.rotation.y = Math.sin(time * 1.4) * 0.2;
			mesh.position.y += Math.sin(time * 2.5) * 0.01;
		}
	}
});
