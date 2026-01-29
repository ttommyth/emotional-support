import * as THREE from 'three';
import type { RobotActionDefinition } from '../types';
import type { PropState } from './props';

export const debugging: RobotActionDefinition = {
	name: 'debugging',
	tags: ['work'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		const phase = t % 4.5;
		targets.body.pos.y = Math.sin(t * 1.2) * 0.03;
		targets.body.rot.z = Math.sin(t * 1.0) * 0.02;
		targets.leftArm.rot.set(-0.95, 0, 0.25);
		if (phase < 1.5) {
			const p = phase / 1.5;
			targets.head.rot.x = -0.12 - p * 0.06;
			targets.head.rot.z = -0.05 + p * 0.05;
			targets.rightArm.rot.set(-0.9, 0.1, 0.7);
		} else if (phase < 3.5) {
			const p = phase - 1.5;
			targets.head.rot.x = -0.18 + Math.sin(p * 2) * 0.03;
			targets.head.rot.z = Math.sin(p * 2) * 0.03;
			targets.rightArm.rot.set(-0.8, 0.15, 0.9);
			targets.rightArm.rot.x += Math.sin(p * 10) * 0.12;
		} else {
			const p = (phase - 3.5) / 1.0;
			targets.head.rot.x = -0.18 + p * 0.06;
			targets.head.rot.z = 0.03 - p * 0.03;
		targets.rightArm.rot.set(-0.8 + p * 0.1, 0.15, 0.9 - p * 0.2);
		}
	},
	update: (_delta, time, { props }) => {
		if (props.debugging.state === 'held') {
			props.debugging.mesh.rotation.z = Math.sin(time * 2) * 0.2;
			props.debugging.mesh.position.y += Math.sin(time * 3) * 0.01;
		}
	}
};

export function createDebuggingProp(scene: THREE.Scene, bodyPivot: THREE.Object3D): PropState {
	const matRing = new THREE.MeshStandardMaterial({ color: 0x636e72, metalness: 0.7, roughness: 0.3 });
	const matGlass = new THREE.MeshStandardMaterial({ color: 0xa3d8ff, transparent: true, opacity: 0.7 });
	const matHandle = new THREE.MeshStandardMaterial({ color: 0x2d3436, metalness: 0.5, roughness: 0.5 });

	const glassAnchor = new THREE.Group();
	glassAnchor.position.set(2.3, 1.3, 2.4);
	glassAnchor.rotation.set(0.2, Math.PI, -0.2);
	bodyPivot.add(glassAnchor);

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

	scene.add(glass);
	return { mesh: glass, anchor: glassAnchor, state: 'hidden', vel: new THREE.Vector3() };
}
