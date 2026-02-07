import * as THREE from 'three';
import { defineAction, ANCHOR_PRESETS } from './helpers';

export const thinking = defineAction({
	name: 'thinking',
	tags: ['work'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		// Contemplative sway — gentle weight shift
		targets.body.pos.y = Math.sin(t * 1.2) * 0.05;
		targets.body.rot.z = Math.sin(t * 0.8) * 0.03;

		// Right hand to chin — classic thinker pose
		targets.rightArm.rot.set(-1.8, -0.5, -0.3);
		targets.rightArm.pos.set(2.2, 1.5, 0);

		// Left arm relaxed, occasionally shifts
		targets.leftArm.rot.set(-0.3 + Math.sin(t * 0.6) * 0.05, -0.15, -0.25);

		// Head: slow contemplative look around, tilts while pondering
		const phase = t % 7;
		if (phase < 3) {
			// Looking one direction, thinking
			const p = phase / 3;
			targets.head.rot.x = -0.1 + Math.sin(p * Math.PI) * 0.08;
			targets.head.rot.y = 0.2 + Math.sin(p * Math.PI * 0.5) * 0.1;
			targets.head.rot.z = Math.sin(p * Math.PI) * 0.05;
		} else if (phase < 5) {
			// Slow shift to other side
			const p = (phase - 3) / 2;
			targets.head.rot.x = -0.1 + Math.sin(p * Math.PI) * 0.06;
			targets.head.rot.y = 0.3 - p * 0.6;
			targets.head.rot.z = -Math.sin(p * Math.PI) * 0.04;
		} else {
			// Look up — eureka moment building
			const p = (phase - 5) / 2;
			targets.head.rot.x = -0.1 - p * 0.15;
			targets.head.rot.y = -0.3 + p * 0.3;
		}
	},
	prop: {
		anchor: { ...ANCHOR_PRESETS.headRight },
		buildMesh: () => {
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

			return bulb;
		},
		heldUpdate: (mesh, time) => {
			mesh.position.y += Math.sin(time * 2) * 0.02;
			mesh.rotation.z = Math.sin(time) * 0.2;
		}
	}
});
