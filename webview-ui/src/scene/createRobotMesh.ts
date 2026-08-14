import {
	CapsuleGeometry,
	CircleGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	SphereGeometry
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry';
import type { MeshBasicMaterial, MeshLambertMaterial, Scene } from 'three';

export type RobotMaterials = {
	matWhite: MeshLambertMaterial;
	matOrange: MeshLambertMaterial;
	matDark: MeshLambertMaterial;
	matMetal: MeshLambertMaterial;
	matEye: MeshBasicMaterial;
};

export type RobotMesh = {
	robot: Group;
	bodyPivot: Group;
	headGroup: Group;
	leftEye: Mesh;
	rightEye: Mesh;
	leftArm: Group;
	rightArm: Group;
	leftLeg: Group;
	rightLeg: Group;
	antennaBall: Mesh;
};

/**
 * Build the robot's 3D mesh (body, head, visor, eyes, ears, antenna, limbs).
 * The pieces not needed by the animation loop (torso, visor, ears, antenna
 * stem) are kept internal to the mesh group.
 */
export function createRobotMesh(scene: Scene, mats: RobotMaterials): RobotMesh {
	const { matWhite, matOrange, matDark, matMetal, matEye } = mats;

	const robot = new Group();
	robot.position.set(0, -0.6, 2.5);
	scene.add(robot);
	const bodyPivot = new Group();
	robot.add(bodyPivot);

	const torso = new Mesh(new RoundedBoxGeometry(3.5, 4.5, 2.5, 4, 0.5), matWhite);
	torso.castShadow = true;
	bodyPivot.add(torso);

	const chestPlate = new Mesh(new RoundedBoxGeometry(2, 1.4, 0.2, 4, 0.1), matOrange);
	chestPlate.position.set(0, 1, 1.3);
	chestPlate.castShadow = true;
	bodyPivot.add(chestPlate);

	const headGroup = new Group();
	headGroup.position.set(0, 3.5, 0);
	bodyPivot.add(headGroup);

	const headMesh = new Mesh(new RoundedBoxGeometry(5, 4, 3.5, 4, 0.2), matWhite);
	headMesh.castShadow = true;
	headGroup.add(headMesh);

	const visor = new Mesh(new RoundedBoxGeometry(4, 2.2, 0.5, 4, 0.1), matDark);
	visor.position.set(0, 0, 1.8);
	headGroup.add(visor);

	const leftEye = new Mesh(new CircleGeometry(0.4, 32), matEye);
	leftEye.position.set(-1, 0, 2.1);
	headGroup.add(leftEye);
	const rightEye = leftEye.clone();
	rightEye.position.set(1, 0, 2.1);
	headGroup.add(rightEye);

	const earGeo = new CylinderGeometry(0.6, 0.6, 0.5, 32);
	const leftEar = new Mesh(earGeo, matOrange);
	leftEar.rotation.z = Math.PI / 2;
	leftEar.position.set(-2.8, 0, 0);
	headGroup.add(leftEar);
	const rightEar = leftEar.clone();
	rightEar.position.set(2.8, 0, 0);
	headGroup.add(rightEar);

	const antennaStem = new Mesh(new CylinderGeometry(0.1, 0.3, 1, 16), matMetal);
	antennaStem.position.set(0, 2.5, 0);
	headGroup.add(antennaStem);
	const antennaBall = new Mesh(new SphereGeometry(0.4, 16, 16), matOrange);
	antennaBall.position.set(0, 3, 0);
	headGroup.add(antennaBall);

	function createLimb(x: number, y: number, isArm = false) {
		const group = new Group();
		group.position.set(x, y, 0);
		const limbMesh = new Mesh(new CapsuleGeometry(0.6, 2, 4, 8), isArm ? matMetal : matDark);
		limbMesh.position.y = -1;
		limbMesh.castShadow = true;
		group.add(limbMesh);
		if (isArm) {
			const hand = new Mesh(new SphereGeometry(0.8, 16, 16), matWhite);
			hand.position.y = -2.2;
			hand.castShadow = true;
			group.add(hand);
		} else {
			const foot = new Mesh(new RoundedBoxGeometry(1.2, 0.8, 1.8, 4, 0.2), matWhite);
			foot.position.set(0, -2, 0.5);
			foot.castShadow = true;
			group.add(foot);
		}
		return group;
	}

	const leftArm = createLimb(-2.2, 1.5, true);
	bodyPivot.add(leftArm);
	const rightArm = createLimb(2.2, 1.5, true);
	bodyPivot.add(rightArm);
	const leftLeg = createLimb(-1.2, -2.5, false);
	bodyPivot.add(leftLeg);
	const rightLeg = createLimb(1.2, -2.5, false);
	bodyPivot.add(rightLeg);

	return { robot, bodyPivot, headGroup, leftEye, rightEye, leftArm, rightArm, leftLeg, rightLeg, antennaBall };
}
