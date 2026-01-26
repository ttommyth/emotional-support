import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry';
import type { RobotActionDefinition } from '../types';
import type { PropState } from './props';

export const coding: RobotActionDefinition = {
	name: 'coding',
	apply: (t, { targets }) => {
		const jL = Math.sin(t * 25) * 0.05;
		const jR = Math.cos(t * 25) * 0.05;
		targets.leftArm.rot.set(-1.5, 0, 0.2);
		targets.rightArm.rot.set(-1.5, 0, -0.2);
		targets.leftArm.pos.y += jL;
		targets.rightArm.pos.y += jR;
		targets.head.rot.x = 0.2;
		targets.head.pos.y = 3.5 + Math.sin(t * 10) * 0.02;
	}
};

export function createCodingProp(scene: THREE.Scene, bodyPivot: THREE.Object3D): PropState {
	const matBody = new THREE.MeshLambertMaterial({ color: 0x636e72 });
	const matScreen = new THREE.MeshBasicMaterial({ color: 0x74b9ff });

	const laptopAnchor = new THREE.Group();
	laptopAnchor.position.set(0, 0.5, 3.2);
	laptopAnchor.rotation.set(-0.3, Math.PI, 0);
	bodyPivot.add(laptopAnchor);

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

	scene.add(laptop);

	return { mesh: laptop, anchor: laptopAnchor, state: 'hidden', vel: new THREE.Vector3() };
}
