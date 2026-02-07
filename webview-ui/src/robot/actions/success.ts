import * as THREE from 'three';
import { defineAction, ANCHOR_PRESETS } from './helpers';

export const success = defineAction({
	name: 'success',
	tags: ['work'],
	eyeColor: 'green',
	apply: (t, { targets }) => {
		// Rhythmic celebration bounces with arm pumps
		const bounce = Math.abs(Math.sin(t * 3.5));
		const pump = Math.sin(t * 3.5);
		targets.body.pos.y = bounce * 0.6;
		targets.body.rot.z = Math.sin(t * 1.8) * 0.08;

		// Arms pump up on bounce, down on land
		const armLift = pump > 0 ? pump : 0;
		targets.leftArm.rot.set(-0.3 - armLift * 2.0, -0.2, -0.8 - armLift * 0.6);
		targets.rightArm.rot.set(-0.3 - armLift * 2.0, 0.2, 0.8 + armLift * 0.6);
		targets.leftArm.pos.y = 1.5 + armLift * 0.3;
		targets.rightArm.pos.y = 1.5 + armLift * 0.3;

		// Happy head bob
		targets.head.rot.z = Math.sin(t * 3.5) * 0.12;
		targets.head.rot.y = Math.sin(t * 1.4) * 0.15;
		targets.head.rot.x = -0.1 + bounce * 0.05;

		// Little leg kicks on bounce
		targets.leftLeg.rot.x = Math.max(0, pump) * 0.3;
		targets.rightLeg.rot.x = Math.max(0, -pump) * 0.3;
	},
	prop: {
		anchor: { ...ANCHOR_PRESETS.aboveHead },
		buildMesh: () => {
			const matPropGold = new THREE.MeshPhongMaterial({ color: 0xfdcb6e, shininess: 100 });

			const sGroup = new THREE.Group();
			const starShape = new THREE.Shape();
			for (let i = 0; i < 5; i++) {
				const th = (i / 5) * Math.PI * 2;
				const thIn = ((i + 0.5) / 5) * Math.PI * 2;
				i === 0 ? starShape.moveTo(Math.sin(th), Math.cos(th)) : starShape.lineTo(Math.sin(th), Math.cos(th));
				starShape.lineTo(Math.sin(thIn) * 0.4, Math.cos(thIn) * 0.4);
			}
			starShape.closePath();
			const starMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape, { depth: 0.2, bevelEnabled: false }), matPropGold);
			starMesh.rotation.x = Math.PI;
			sGroup.add(starMesh);

			return sGroup;
		},
		heldUpdate: (mesh, time, delta) => {
			mesh.rotation.y += delta * 2;
			mesh.scale.setScalar(1 + Math.sin(time * 5) * 0.2);
		}
	}
});
