/**
 * tidyup — Robot bends forward and sweeps side-to-side with a broom.
 * Used both as an explicit action and as the cleanup animation when
 * the robot autonomously picks up ground props.
 */

import * as THREE from 'three';
import { defineAction, ANCHOR_PRESETS } from './helpers';

export const tidyup = defineAction({
	name: 'tidyup',
	tags: ['idleFiller'],
	eyeColor: 'green',
	apply: (time, { targets }) => {
		// Lean forward and sweep side to side
		const sweep = Math.sin(time * 3) * 0.4;
		const lean = 0.35 + Math.sin(time * 1.5) * 0.05;

		targets.body.pos.set(0, -0.6, 0.3);
		targets.body.rot.set(lean, sweep * 0.15, 0);
		targets.head.rot.set(-0.2, sweep * 0.3, 0);

		// Arms sweep together in a broom-push motion
		targets.leftArm.rot.set(-0.5 + sweep * 0.2, 0, 0.25);
		targets.rightArm.rot.set(-0.6 - sweep * 0.2, 0, -0.25);

		// Legs slightly bent
		targets.leftLeg.rot.set(0.15, 0, 0);
		targets.rightLeg.rot.set(0.15, 0, 0);
	},
	prop: {
		anchor: {
			...ANCHOR_PRESETS.frontHeld,
			position: [0.5, -0.2, 3.0],
			rotation: [0.8, Math.PI, 0.3]
		},
		buildMesh: () => {
			const broom = new THREE.Group();

			// Handle — long wooden stick
			const matWood = new THREE.MeshLambertMaterial({ color: 0xb2875a });
			const handle = new THREE.Mesh(
				new THREE.CylinderGeometry(0.06, 0.06, 3.0, 8),
				matWood
			);
			handle.castShadow = true;
			broom.add(handle);

			// Bristles — a flat fan shape at the bottom
			const matBristles = new THREE.MeshLambertMaterial({ color: 0xd4a76a });
			const bristleBlock = new THREE.Mesh(
				new THREE.BoxGeometry(1.0, 0.15, 0.5),
				matBristles
			);
			bristleBlock.position.set(0, -1.5, 0);
			broom.add(bristleBlock);

			// Individual bristle strands for visual richness
			const matStrand = new THREE.MeshLambertMaterial({ color: 0xc49a6c });
			for (let i = 0; i < 7; i++) {
				const strand = new THREE.Mesh(
					new THREE.CylinderGeometry(0.015, 0.02, 0.6, 4),
					matStrand
				);
				strand.position.set(
					-0.35 + i * 0.12,
					-1.75,
					(Math.random() - 0.5) * 0.2
				);
				strand.rotation.x = 0.1 * (Math.random() - 0.5);
				broom.add(strand);
			}

			// Small ribbon/band where bristles meet handle
			const matBand = new THREE.MeshLambertMaterial({ color: 0x636e72 });
			const band = new THREE.Mesh(
				new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8),
				matBand
			);
			band.position.set(0, -1.42, 0);
			broom.add(band);

			return broom;
		},
		heldUpdate: (mesh, time) => {
			// Gentle wobble while sweeping
			mesh.rotation.z = Math.sin(time * 3) * 0.15;
		}
	}
});
