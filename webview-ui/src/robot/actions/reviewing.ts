import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry';
import type { RobotActionDefinition } from '../types';
import type { PropState } from './props';

export const reviewing: RobotActionDefinition = {
	name: 'reviewing',
	tags: ['work'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		const phase = t % 4;
		targets.leftArm.rot.set(-0.9, 0, 0.4);
		targets.rightArm.rot.set(-0.9, 0, -0.4);
		if (phase < 2) {
			const p = phase / 2;
			targets.head.rot.x = 0.14;
		targets.head.rot.y = -0.3 + p * 0.6;
		} else {
			const p = (phase - 2) / 2;
			targets.head.rot.x = 0.1 + Math.sin(p * Math.PI) * 0.04;
			targets.head.rot.y = 0.3 - p * 0.6;
			targets.rightArm.pos.y = 1.5 + Math.sin(p * Math.PI) * 0.05;
		}
	},
	update: (_delta, time, { props }) => {
		if (props.reviewing.state === 'held') {
			props.reviewing.mesh.rotation.z = Math.sin(time * 1.5) * 0.1;
		}
	}
};

export function createReviewingProp(scene: THREE.Scene, bodyPivot: THREE.Object3D): PropState {
	const matPaper = new THREE.MeshLambertMaterial({ color: 0xfdfdfd });
	const matClip = new THREE.MeshLambertMaterial({ color: 0x636e72 });
	const matCheck = new THREE.MeshBasicMaterial({ color: 0x00b894 });

	const clipboardAnchor = new THREE.Group();
	clipboardAnchor.position.set(0.2, 0.9, 3.2);
	clipboardAnchor.rotation.set(0.15, Math.PI, 0);
	bodyPivot.add(clipboardAnchor);

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

	scene.add(clipboard);
	return { mesh: clipboard, anchor: clipboardAnchor, state: 'hidden', vel: new THREE.Vector3() };
}
