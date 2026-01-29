import * as THREE from 'three';
import type { RobotActionDefinition } from '../types';
import type { PropState } from './props';

export const testing: RobotActionDefinition = {
	name: 'testing',
	tags: ['work'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		const phase = t % 3;
		const tap = Math.sin(t * 12) * 0.05;
		targets.leftArm.rot.set(-1.2, 0, 0.2);
		targets.rightArm.rot.set(-1.2, 0, -0.2);
		if (phase < 2) {
			targets.leftArm.pos.y += tap;
			targets.rightArm.pos.y -= tap;
			targets.head.rot.x = 0.12 + Math.sin(t * 2) * 0.02;
		} else {
			const p = phase - 2;
			targets.leftArm.pos.y += Math.sin(p * Math.PI) * 0.02;
			targets.rightArm.pos.y -= Math.sin(p * Math.PI) * 0.02;
			targets.head.rot.x = 0.1;
		}
	},
	update: (_delta, time, { props }) => {
		if (props.testing.state === 'held') {
			props.testing.mesh.rotation.y = Math.sin(time * 1.4) * 0.2;
			props.testing.mesh.position.y += Math.sin(time * 2.5) * 0.01;
		}
	}
};

export function createTestingProp(scene: THREE.Scene, bodyPivot: THREE.Object3D): PropState {
	const matGlass = new THREE.MeshStandardMaterial({ color: 0x81ecec, transparent: true, opacity: 0.7 });
	const matFluid = new THREE.MeshStandardMaterial({ color: 0x74b9ff, emissive: 0x74b9ff, emissiveIntensity: 0.2 });
	const matRack = new THREE.MeshStandardMaterial({ color: 0x636e72, metalness: 0.6, roughness: 0.4 });

	const rackAnchor = new THREE.Group();
	rackAnchor.position.set(0, 0.7, 3.1);
	rackAnchor.rotation.set(0.15, Math.PI, 0);
	bodyPivot.add(rackAnchor);

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

	scene.add(rack);
	return { mesh: rack, anchor: rackAnchor, state: 'hidden', vel: new THREE.Vector3() };
}
