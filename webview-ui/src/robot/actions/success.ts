import * as THREE from 'three';
import type { RobotActionDefinition } from '../types';
import type { PropState } from './props';

export const success: RobotActionDefinition = {
	name: 'success',
	tags: ['work'],
	apply: (t, { targets }) => {
		const jump = Math.abs(Math.sin(t * 8));
		targets.body.pos.y = jump * 0.5;
		targets.leftArm.rot.set(0, 0, -2.5);
		targets.rightArm.rot.set(0, 0, 2.5);
		targets.head.rot.z = Math.sin(t * 8) * 0.1;
	},
	update: (delta, time, { props }) => {
		if (props.success.state === 'held') {
			props.success.mesh.rotation.y += delta * 2;
			props.success.mesh.scale.setScalar(1 + Math.sin(time * 5) * 0.2);
		}
	}
};

export function createSuccessProp(scene: THREE.Scene, bodyPivot: THREE.Object3D): PropState {
	const matPropGold = new THREE.MeshPhongMaterial({ color: 0xfdcb6e, shininess: 100 });

	const starAnchor = new THREE.Group();
	starAnchor.position.set(0, 6.8, 1.1);
	starAnchor.rotation.set(0, Math.PI, 0);
	bodyPivot.add(starAnchor);

	const sGroup = new THREE.Group();
	const starShape = new THREE.Shape();
	for (let i = 0; i < 5; i++) {
		const th = (i / 5) * Math.PI * 2;
		const thIn = ((i + 0.5) / 5) * Math.PI * 2;
		i === 0 ? starShape.moveTo(Math.sin(th), Math.cos(th)) : starShape.lineTo(Math.sin(th), Math.cos(th));
		starShape.lineTo(Math.sin(thIn) * 0.4, Math.cos(thIn) * 0.4);
	}
	starShape.closePath();
	const starMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape, { depth: 0.2, bevelEnabled: false }), matPropGold);
	starMesh.rotation.x = Math.PI;
	sGroup.add(starMesh);
	scene.add(sGroup);

	return { mesh: sGroup, anchor: starAnchor, state: 'hidden', vel: new THREE.Vector3() };
}
