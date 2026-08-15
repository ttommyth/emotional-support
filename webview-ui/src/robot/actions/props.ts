/**
 * Props system — dynamic registry for 3D props held by the robot.
 *
 * Props are 3D objects that appear in the robot's hands/above head during
 * specific actions. This module manages their lifecycle:
 *   hidden → held → dropping → ground → hidden (fade)
 *
 * The registry is a Map<string, PropState> keyed by action name, so new
 * actions with props are automatically supported without editing this file.
 */

import * as THREE from 'three';
import type { PropDefinition } from './helpers';
import { createPropFromDefinition } from './helpers';

// Re-export PropState from helpers for backward compatibility
export type { PropState, PropDefinition, AnchorConfig } from './helpers';

export type RobotProps = {
	/** Dynamic prop registry — keyed by action name */
	items: Map<string, import('./helpers').PropState>;
	/** Sleep Z particles (special case, not a standard prop) */
	zParticles: Array<{ mesh: THREE.Sprite; offset: number }>;
	/** Get a prop by action name */
	get: (name: string) => import('./helpers').PropState | undefined;
	/** Get all props currently sitting on the ground with their world positions */
	getGroundProps: () => Array<{ name: string; x: number; z: number; timer: number }>;
};

export type CreatePropsInput = {
	scene: THREE.Scene;
	bodyPivot: THREE.Object3D;
	/** Arm groups — used when a prop is parented to a hand via `attachToArm`. */
	leftArm: THREE.Object3D;
	rightArm: THREE.Object3D;
};

/**
 * Creates the robot props registry from all registered action prop definitions.
 * The actionPropDefs map is auto-collected from actions that have a `prop` field.
 */
export function createRobotProps(
	{ scene, bodyPivot, leftArm, rightArm }: CreatePropsInput,
	actionPropDefs: Map<string, PropDefinition>
): RobotProps {
	const items = new Map<string, import('./helpers').PropState>();

	for (const [name, propDef] of actionPropDefs) {
		items.set(name, createPropFromDefinition(propDef, scene, bodyPivot, { left: leftArm, right: rightArm }));
	}

	const zParticles = createSleepParticles(scene);

	return {
		items,
		zParticles,
		get: (name: string) => items.get(name),
		getGroundProps: () => {
			const result: Array<{ name: string; x: number; z: number; timer: number }> = [];
			for (const [name, prop] of items) {
				if (prop.state === 'ground') {
					result.push({
						name,
						x: prop.mesh.position.x,
						z: prop.mesh.position.z,
						timer: prop.groundTimer
					});
				}
			}
			return result;
		}
	};
}

/**
 * Per-frame prop lifecycle update.
 * Handles held/dropping/ground/hidden state transitions for all registered props.
 */
export function updateProps(delta: number, action: string, props: RobotProps) {
	for (const [key, prop] of props.items) {
		const isHeld = key === action && action !== 'walk';

		if (isHeld && prop.state !== 'dropping') {
			prop.state = 'held';
			prop.groundTimer = 0;
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
				// give dropped props a full‑circle yaw variance (was only half-circle previously)
				prop.mesh.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2 - Math.PI);
			}
		} else if (prop.state === 'ground') {
			prop.groundTimer += delta;
			// Linger on the ground for a while before fading
			const GROUND_LINGER_SECONDS = 20;
			if (prop.groundTimer > GROUND_LINGER_SECONDS) {
				prop.mesh.scale.lerp(new THREE.Vector3(0, 0, 0), 0.05);
				if (prop.mesh.scale.y < 0.05) {
					prop.state = 'hidden';
					prop.groundTimer = 0;
				}
			}
		}
	}

	if (action !== 'sleep') {
		props.zParticles.forEach((z) => {
			z.mesh.visible = false;
		});
	}
}

function createSleepParticles(scene: THREE.Scene): RobotProps['zParticles'] {
	const zParticles: RobotProps['zParticles'] = [];
	for (let i = 0; i < 3; i++) {
		const c = document.createElement('canvas');
		c.width = 64;
		c.height = 64;
		const ctx = c.getContext('2d');
		if (ctx) {
			ctx.fillStyle = 'white';
			ctx.font = 'bold 50px sans-serif';
			ctx.fillText('Z', 10, 50);
		}
		const zSprite = new THREE.Sprite(
			new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0 })
		);
		zSprite.scale.set(1.5, 1.5, 1.5);
		scene.add(zSprite);
		zParticles.push({ mesh: zSprite, offset: i * 2 });
	}
	return zParticles;
}
