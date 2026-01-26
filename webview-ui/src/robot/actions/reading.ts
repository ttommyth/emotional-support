import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry';
import type { RobotActionDefinition } from '../types';
import type { PropState } from './props';

export const reading: RobotActionDefinition = {
	name: 'reading',
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
	const matBookCover = new THREE.MeshLambertMaterial({ color: 0xe17055 });
	const matWhite = new THREE.MeshLambertMaterial({ color: 0xffffff });

	const bookAnchor = new THREE.Group();
	bookAnchor.position.set(0, 0.5, 3.2);
	bookAnchor.rotation.set(-0.8, Math.PI, 0);
	bodyPivot.add(bookAnchor);

	const book = new THREE.Group();
	book.add(new THREE.Mesh(new RoundedBoxGeometry(2.8, 3.8, 0.3, 2, 0.05), matBookCover));
	const pages = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.6, 0.2), matWhite);
	pages.position.z = 0.15;
	book.add(pages);
	scene.add(book);

	return { mesh: book, anchor: bookAnchor, state: 'hidden', vel: new THREE.Vector3() };
}
