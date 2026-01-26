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
	const matPropBody = new THREE.MeshLambertMaterial({ color: 0x2d3436 });
	const matPropScreen = new THREE.MeshBasicMaterial({ color: 0x0984e3 });

	const laptopAnchor = new THREE.Group();
	laptopAnchor.position.set(0, 0, 3.8);
	laptopAnchor.rotation.set(-0.2, Math.PI, 0);
	bodyPivot.add(laptopAnchor);

	const laptop = new THREE.Group();
	laptop.add(new THREE.Mesh(new RoundedBoxGeometry(3, 0.2, 2.2, 2, 0.05), matPropBody));
	const screenPivot = new THREE.Group();
	screenPivot.position.set(0, 0.1, -1.0);
	laptop.add(screenPivot);
	const lapScreen = new THREE.Mesh(new RoundedBoxGeometry(3, 2, 0.2, 2, 0.05), matPropBody);
	lapScreen.position.set(0, 1, 0);
	screenPivot.add(lapScreen);
	const lapDisplay = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), matPropScreen);
	lapDisplay.position.set(0, 1, 0.11);
	screenPivot.add(lapDisplay);
	screenPivot.rotation.x = 0.4;
	scene.add(laptop);

	return { mesh: laptop, anchor: laptopAnchor, state: 'hidden', vel: new THREE.Vector3() };
}
