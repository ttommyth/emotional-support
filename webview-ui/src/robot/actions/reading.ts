import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry';
import type { RobotActionDefinition } from '../types';
import type { PropState } from './props';

export const reading: RobotActionDefinition = {
	name: 'reading',
	tags: ['work'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		targets.leftArm.rot.set(-1.0, 0, 0.5);
		targets.rightArm.rot.set(-1.0, 0, -0.5);
		const cycle = (t * 1.5) % 2;
		const lookY =
			cycle < 1.5
				? THREE.MathUtils.lerp(-0.4, 0.4, cycle / 1.5)
				: THREE.MathUtils.lerp(0.4, -0.4, (cycle - 1.5) / 0.5);
		targets.head.rot.set(0.2, lookY, 0);
	}
};

export function createReadingProp(scene: THREE.Scene, bodyPivot: THREE.Object3D): PropState {
	const matPaper = new THREE.MeshLambertMaterial({ color: 0xfdfdfd });
	const matInk = new THREE.MeshBasicMaterial({ color: 0x74b9ff });
	const matClip = new THREE.MeshLambertMaterial({ color: 0x636e72 });

	const paperAnchor = new THREE.Group();
	paperAnchor.position.set(0, 0.6, 3.4);
	paperAnchor.rotation.set(0.3, Math.PI, 0);
	bodyPivot.add(paperAnchor);

	const paper = new THREE.Group();
	const sheet = new THREE.Mesh(new RoundedBoxGeometry(2.6, 3.2, 0.05, 2, 0.03), matPaper);
	sheet.castShadow = true;
	paper.add(sheet);

	const lines = new THREE.Group();
	for (let i = 0; i < 5; i++) {
		const line = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.08), matInk);
		line.position.set(0, 0.9 - i * 0.5, 0.03);
		lines.add(line);
	}
	paper.add(lines);

	const clip = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.2, 0.2, 2, 0.05), matClip);
	clip.position.set(0, 1.7, 0.05);
	paper.add(clip);

	scene.add(paper);

	return { mesh: paper, anchor: paperAnchor, state: 'hidden', vel: new THREE.Vector3() };
}
