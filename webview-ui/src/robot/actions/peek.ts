import * as THREE from 'three';
import type { RobotActionDefinition } from '../types';

const tempHead = new THREE.Vector3();
const tempCam = new THREE.Vector3();

export const peek: RobotActionDefinition = {
	name: 'peek',
	tags: ['blocksAutoLookAt', 'movement'],
	apply: (t, { targets, robot, camera }) => {
		const side = robot.position.x >= 0 ? 1 : -1;
		const bob = Math.sin(t * 2.4) * 0.07;
		const sway = Math.sin(t * 1.8) * 0.12;

		targets.body.pos.set(-side * 1.45, -0.45 + bob, 0);
		targets.body.rot.z = side * (0.22 + sway * 0.5);

		targets.head.pos.set(-side * 0.22, 3.35 + bob * 0.5, 0);

		camera.getWorldPosition(tempCam);
		robot.localToWorld(tempHead.copy(targets.head.pos));
		const yaw = Math.atan2(tempCam.x - tempHead.x, tempCam.z - tempHead.z);
		const pitch = Math.atan2(tempCam.y - tempHead.y, tempCam.distanceTo(tempHead));
		targets.head.rot.y = THREE.MathUtils.clamp(yaw, -1.2, 1.2);
		targets.head.rot.x = THREE.MathUtils.clamp(pitch, -0.4, 0.6) -0.1;
		targets.head.rot.z = -side * (0.32 + sway * 0.25);

		const treeArm = side === 1 ? targets.rightArm : targets.leftArm;
		const peekArm = side === 1 ? targets.leftArm : targets.rightArm;

		treeArm.pos.y = 1.35;
		treeArm.rot.set(-0.75, side * 0.25, side * -1.55);

		peekArm.pos.y = 1.7;
		peekArm.rot.set(-1.2, 0.08, side * 0.75);
		peekArm.rot.x += Math.sin(t * 2.8) * 0.1;

		targets.leftLeg.rot.x = -0.18;
		targets.rightLeg.rot.x = -0.18;
	}
};
