import * as THREE from 'three';
import { createCodingProp } from './coding';
import { createDebuggingProp } from './debugging';
import { createReviewingProp } from './reviewing';
import { createRefactoringProp } from './refactoring';
import { createTestingProp } from './testing';
import { createReadingProp } from './reading';
import { createThinkingProp } from './thinking';
import { createSuccessProp } from './success';
import { createSleepParticles } from './sleep';

export type PropState = {
	mesh: THREE.Object3D;
	anchor: THREE.Object3D;
	state: 'hidden' | 'held' | 'dropping' | 'ground';
	vel: THREE.Vector3;
};

export type RobotProps = {
	coding: PropState;
	debugging: PropState;
	reviewing: PropState;
	refactoring: PropState;
	testing: PropState;
	reading: PropState;
	thinking: PropState;
	success: PropState;
	zParticles: Array<{ mesh: THREE.Sprite; offset: number }>;
};

export type CreatePropsInput = {
	scene: THREE.Scene;
	bodyPivot: THREE.Object3D;
};


export function createRobotProps({ scene, bodyPivot }: CreatePropsInput): RobotProps {
	return {
		coding: createCodingProp(scene, bodyPivot),
		debugging: createDebuggingProp(scene, bodyPivot),
		reviewing: createReviewingProp(scene, bodyPivot),
		refactoring: createRefactoringProp(scene, bodyPivot),
		testing: createTestingProp(scene, bodyPivot),
		reading: createReadingProp(scene, bodyPivot),
		thinking: createThinkingProp(scene, bodyPivot),
		success: createSuccessProp(scene, bodyPivot),
		zParticles: createSleepParticles(scene)
	};
}

export function updateProps(delta: number, action: string, props: RobotProps) {
	const entries = Object.entries(props).filter(([key]) => key !== 'zParticles') as Array<[string, PropState]>;
	for (const [key, prop] of entries) {
		const isHeld = key === action && action !== 'walk';

		if (isHeld && prop.state !== 'dropping') {
			prop.state = 'held';
		} else if (prop.state === 'held' && !isHeld) {
			prop.state = 'dropping';
			prop.vel.set((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2 + 2);
		}

		if (prop.state === 'hidden') {
			prop.mesh.visible = false;
			prop.mesh.scale.set(0, 0, 0);
		} else if (prop.state === 'held') {
			prop.mesh.visible = true;
			prop.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
			prop.anchor.getWorldPosition(prop.mesh.position);
			prop.anchor.getWorldQuaternion(prop.mesh.quaternion);
		} else if (prop.state === 'dropping') {
			prop.mesh.visible = true;
			prop.vel.y -= 15 * delta;
			prop.mesh.position.addScaledVector(prop.vel, delta * 3);
			prop.mesh.rotation.x += delta * 3;
			prop.mesh.rotation.z += delta;
			if (prop.mesh.position.y <= -4.3) {
				prop.mesh.position.y = -4.3;
				prop.vel.set(0, 0, 0);
				prop.state = 'ground';
				prop.mesh.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI);
			}
		} else if (prop.state === 'ground') {
			prop.mesh.scale.lerp(new THREE.Vector3(0, 0, 0), 0.05);
			if (prop.mesh.scale.y < 0.05) {
				prop.state = 'hidden';
			}
		}
	}
	if (action !== 'sleep') {
		props.zParticles.forEach((z) => {
			z.mesh.visible = false;
		});
	}
}
