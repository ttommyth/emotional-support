import * as THREE from 'three';
import type { RobotActionDefinition } from '../types';
import type { PropState } from './props';

export const thinking: RobotActionDefinition = {
	name: 'thinking',
	apply: (t, { targets }) => {
		targets.body.pos.y = Math.abs(Math.sin(t * 4)) * 0.1;
		targets.body.rot.z = Math.sin(t * 2) * 0.05;
		targets.rightArm.rot.set(-2.0, -0.5, -0.5);
		targets.rightArm.pos.set(2.2, 1.5, 0);
		targets.leftArm.rot.z = 0.2;
		targets.head.rot.x = -0.3 + Math.sin(t) * 0.1;
		targets.head.rot.y = Math.sin(t * 0.5) * 0.3;
	},
	update: (_delta, time, { props }) => {
		if (props.thinking.state === 'held') {
			props.thinking.mesh.position.y += Math.sin(time * 2) * 0.02;
			props.thinking.mesh.rotation.z = Math.sin(time) * 0.2;
		}
	}
};

export function createThinkingProp(scene: THREE.Scene): PropState {
	const matPropGold = new THREE.MeshPhongMaterial({ color: 0xfdcb6e, shininess: 100 });

	const questionAnchor = new THREE.Group();
	questionAnchor.position.set(2, 6, 0);
	scene.add(questionAnchor);

	const qGroup = new THREE.Group();
	const qShape = new THREE.Shape();
	qShape.moveTo(0, 0);
	qShape.absarc(0, 0.5, 0.5, 0, Math.PI, true);
	qShape.lineTo(0, -0.5);
	const qMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(qShape, { depth: 0.2, bevelEnabled: false }), matPropGold);
	qMesh.scale.set(1.5, 1.5, 1.5);
	qMesh.rotation.y = Math.PI;
	qGroup.add(qMesh);
	const qDot = new THREE.Mesh(new THREE.SphereGeometry(0.25), matPropGold);
	qDot.position.y = -1.2;
	qGroup.add(qDot);
	scene.add(qGroup);

	return { mesh: qGroup, anchor: questionAnchor, state: 'hidden', vel: new THREE.Vector3() };
}
