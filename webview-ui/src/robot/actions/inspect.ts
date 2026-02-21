import * as THREE from 'three';
import { defineAction } from './helpers';

// A generic "inspect" action used when the robot wants to look over
// whatever prop it has picked up. The mesh is intentionally simple –
// a little group containing a box and a sphere – so it can represent a
// vague collection of items. The animation slowly rotates the object
// back and forth in the robot's hands as if it's being examined.

export const inspect = defineAction({
	name: 'inspect',
	tags: ['idleLike'],
	eyeColor: 'purple',
	apply: (time, { targets }) => {
		// hold arms up and wiggle slightly while rotating the prop
		const spin = time * 1.8;
		const sway = Math.sin(time * 2) * 0.1;

		targets.leftArm.rot.set(-1.2 + sway, 0, 0.2);
		targets.rightArm.rot.set(-1.2 - sway, 0, -0.2);
		targets.leftArm.pos.y = 1.5 + Math.sin(spin) * 0.1;
		targets.rightArm.pos.y = 1.5 + Math.cos(spin) * 0.1;

		// keep head facing forward but with a tiny up/down motion
		targets.head.rot.x = 0.1 + Math.sin(time * 1.3) * 0.02;
	},
	prop: {
		anchor: { position: [0, 0.6, 3.2], rotation: [-0.3, Math.PI, 0] },
		buildMesh: () => {
			const group = new THREE.Group();
			const mat1 = new THREE.MeshLambertMaterial({ color: 0xffd700 });
			const mat2 = new THREE.MeshLambertMaterial({ color: 0x00ff00 });

			const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat1);
			box.castShadow = true;
			group.add(box);

			const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), mat2);
			sphere.position.set(0, 1.2, 0);
			sphere.castShadow = true;
			group.add(sphere);

			return group;
		}
	}
});
