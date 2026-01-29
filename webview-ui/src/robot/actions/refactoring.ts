import * as THREE from 'three';
import type { RobotActionDefinition } from '../types';
import type { PropState } from './props';

export const refactoring: RobotActionDefinition = {
	name: 'refactoring',
	tags: ['work'],
	apply: (t, { targets }) => {
		const sweep = Math.sin(t * 2.2) * 0.5;
		targets.body.rot.z = Math.sin(t * 1.6) * 0.04;
		targets.leftArm.rot.set(-1.0, 0, 0.25 + sweep * 0.15);
		targets.rightArm.rot.set(-1.0, 0, -0.25 + sweep * 0.15);
		targets.head.rot.y = Math.sin(t * 1.1) * 0.18;
	},
	update: (_delta, time, { props }) => {
		if (props.refactoring.state === 'held') {
			props.refactoring.mesh.rotation.x = Math.sin(time * 2) * 0.2;
			props.refactoring.mesh.rotation.z = Math.sin(time * 1.5) * 0.2;
		}
	}
};

export function createRefactoringProp(scene: THREE.Scene, bodyPivot: THREE.Object3D): PropState {
	const matMetal = new THREE.MeshStandardMaterial({ color: 0xb2bec3, metalness: 0.8, roughness: 0.3 });
	const matHandle = new THREE.MeshStandardMaterial({ color: 0x2d3436, metalness: 0.4, roughness: 0.6 });

	const wrenchAnchor = new THREE.Group();
	wrenchAnchor.position.set(-2.3, 1.3, 2.4);
	wrenchAnchor.rotation.set(0.2, Math.PI, 0.2);
	bodyPivot.add(wrenchAnchor);

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

	scene.add(wrench);
	return { mesh: wrench, anchor: wrenchAnchor, state: 'hidden', vel: new THREE.Vector3() };
}
