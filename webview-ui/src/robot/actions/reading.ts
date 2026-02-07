import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry';
import { defineAction } from './helpers';

export const reading = defineAction({
	name: 'reading',
	tags: ['work'],
	eyeColor: 'cyan',
	apply: (t, { targets }) => {
		// Arms hold paper, slight adjustments
		targets.leftArm.rot.set(-1.0, 0.08, 0.45);
		targets.rightArm.rot.set(-1.0, -0.08, -0.45);

		// Reading scan — eyes track lines with occasional page shifts
		const cycle = t % 6;
		if (cycle < 4) {
			// Scanning lines left → right, stepping down
			const line = Math.floor(cycle / 1.0);
			const lineP = (cycle % 1.0);
			const headY = -0.25 + lineP * 0.5;
			const headX = 0.12 + line * 0.04;
			targets.head.rot.set(headX, headY, 0);
		} else if (cycle < 5) {
			// Brief pause + small nod (understanding)
			const p = cycle - 4;
			targets.head.rot.set(0.25 + Math.sin(p * Math.PI) * 0.08, 0, 0);
		} else {
			// Reset — eyes snap back to top
			const p = cycle - 5;
			targets.head.rot.set(0.12, -0.25 * (1 - p), 0);
		}

		// Body: gentle lean with breathing
		targets.body.rot.x = 0.04 + Math.sin(t * 1.1) * 0.02;
		targets.body.pos.y = Math.sin(t * 1.3) * 0.04;
		targets.body.rot.z = Math.sin(t * 0.6) * 0.02;
	},
	prop: {
		anchor: { position: [0, 0.6, 3.4], rotation: [0.3, Math.PI, 0] },
		buildMesh: () => {
			const matPaper = new THREE.MeshLambertMaterial({ color: 0xfdfdfd });
			const matInk = new THREE.MeshBasicMaterial({ color: 0x74b9ff });
			const matClip = new THREE.MeshLambertMaterial({ color: 0x636e72 });

			const paper = new THREE.Group();
			const sheet = new THREE.Mesh(new RoundedBoxGeometry(2.6, 3.2, 0.05, 2, 0.03), matPaper);
			sheet.castShadow = true;
			paper.add(sheet);

			const lines = new THREE.Group();
			for (let i = 0; i < 5; i++) {
				const line = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.08), matInk);
				line.position.set(0, 0.9 - i * 0.5, 0.03);
				lines.add(line);
			}
			paper.add(lines);

			const clip = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.2, 0.2, 2, 0.05), matClip);
			clip.position.set(0, 1.7, 0.05);
			paper.add(clip);

			return paper;
		}
	}
});
