import * as THREE from 'three';
import type { RobotActionDefinition } from '../types';
import type { PropState } from './props';

export const thinking: RobotActionDefinition = {
	name: 'thinking',
	apply: (t, { targets }) => {
		targets.body.pos.y = Math.abs(Math.sin(t * 4)) * 0.1;
		targets.body.rot.z = Math.sin(t * 2) * 0.05;
		targets.rightArm.rot.set(-2.0, -0.5, -0.5);
		targets.rightArm.pos.set(2.2, 1.5, 0);
		targets.leftArm.rot.z = 0.2;
		targets.head.rot.x = -0.3 + Math.sin(t) * 0.1;
		targets.head.rot.y = Math.sin(t * 0.5) * 0.3;
	},
	update: (_delta, time, { props }) => {
		if (props.thinking.state === 'held') {
			props.thinking.mesh.position.y += Math.sin(time * 2) * 0.02;
			props.thinking.mesh.rotation.z = Math.sin(time) * 0.2;
		}
	}
};

export function createThinkingProp(scene: THREE.Scene, bodyPivot: THREE.Object3D): PropState {
	const matGlass = new THREE.MeshStandardMaterial({
		color: 0xfef9c3,
		emissive: 0xfff3b0,
		emissiveIntensity: 0.6,
		roughness: 0.2,
		metalness: 0.1,
		transparent: true,
		opacity: 0.9
	});
	const matBase = new THREE.MeshStandardMaterial({ color: 0x636e72, metalness: 0.7, roughness: 0.3 });
	const matFilament = new THREE.MeshStandardMaterial({ color: 0xf9ca24, emissive: 0xf9ca24, emissiveIntensity: 0.8 });

	const bulbAnchor = new THREE.Group();
	bulbAnchor.position.set(2, 6, 1.2);
	bulbAnchor.rotation.set(0, Math.PI, 0);
	bodyPivot.add(bulbAnchor);

	const bulb = new THREE.Group();
	const glass = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 24), matGlass);
	glass.scale.y = 1.1;
	glass.castShadow = true;
	bulb.add(glass);

	const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.6, 16), matBase);
	base.position.y = -1.0;
	base.castShadow = true;
	bulb.add(base);

	const filament = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.05, 8, 16), matFilament);
	filament.position.y = -0.2;
	filament.rotation.x = Math.PI / 2;
	bulb.add(filament);

	scene.add(bulb);

	return { mesh: bulb, anchor: bulbAnchor, state: 'hidden', vel: new THREE.Vector3() };
}
