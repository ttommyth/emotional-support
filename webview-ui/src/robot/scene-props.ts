/**
 * Scene Props — 3D objects placed on the ground independently of the robot.
 *
 * Unlike action props (anchored to the robot body during specific actions),
 * scene props exist at world positions and can be placed/removed dynamically
 * via MCP commands. The robot can optionally walk to them, pick them up,
 * and transition into the corresponding action.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry';
import type { ScenePropType, ScenePropPlacement } from './types';
import { GROUND_Y } from './types';
import { actionPropDefs } from './actions';

// ─── Mesh Builders ──────────────────────────────────────────────────────────

/**
 * Maps scene prop types to action names whose buildMesh can be reused.
 * These action props already have well-built 3D meshes.
 */
const ACTION_MESH_REUSE: Partial<Record<ScenePropType, string>> = {
	paper: 'reading',
	laptop: 'coding',
	magnifying_glass: 'debugging',
	lightbulb: 'thinking',
	star: 'success'
};

function buildBook(): THREE.Object3D {
	const matCover = new THREE.MeshLambertMaterial({ color: 0x2d3436 });
	const matPages = new THREE.MeshLambertMaterial({ color: 0xfaf3e0 });
	const matSpine = new THREE.MeshLambertMaterial({ color: 0x6c5ce7 });

	const book = new THREE.Group();
	const cover = new THREE.Mesh(new RoundedBoxGeometry(2.0, 2.6, 0.35, 2, 0.04), matCover);
	cover.castShadow = true;
	book.add(cover);

	const pages = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 0.25), matPages);
	pages.position.set(0.05, 0, 0);
	book.add(pages);

	const spine = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.35), matSpine);
	spine.position.set(-1.0, 0, 0);
	book.add(spine);

	return book;
}

function buildClipboard(): THREE.Object3D {
	const matBoard = new THREE.MeshLambertMaterial({ color: 0xb2875a });
	const matPaper = new THREE.MeshLambertMaterial({ color: 0xfdfdfd });
	const matClip = new THREE.MeshLambertMaterial({ color: 0x636e72 });
	const matInk = new THREE.MeshBasicMaterial({ color: 0x2d3436 });

	const clipboard = new THREE.Group();
	const board = new THREE.Mesh(new RoundedBoxGeometry(2.2, 3.0, 0.12, 2, 0.03), matBoard);
	board.castShadow = true;
	clipboard.add(board);

	const paper = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.4), matPaper);
	paper.position.set(0, -0.1, 0.07);
	clipboard.add(paper);

	for (let i = 0; i < 4; i++) {
		const line = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.06), matInk);
		line.position.set(0, 0.7 - i * 0.5, 0.08);
		clipboard.add(line);
	}

	const clip = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.35, 0.2, 2, 0.05), matClip);
	clip.position.set(0, 1.45, 0.1);
	clipboard.add(clip);

	return clipboard;
}

function buildWrench(): THREE.Object3D {
	const matMetal = new THREE.MeshStandardMaterial({ color: 0x636e72, metalness: 0.8, roughness: 0.3 });

	const wrench = new THREE.Group();

	const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.0, 8), matMetal);
	shaft.castShadow = true;
	wrench.add(shaft);

	const jawLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), matMetal);
	jawLeft.position.set(-0.2, 1.15, 0);
	wrench.add(jawLeft);

	const jawRight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), matMetal);
	jawRight.position.set(0.2, 1.15, 0);
	wrench.add(jawRight);

	const jawTop = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.12), matMetal);
	jawTop.position.set(0, 1.4, 0);
	wrench.add(jawTop);

	return wrench;
}

function buildTestTubes(): THREE.Object3D {
	const matGlass = new THREE.MeshStandardMaterial({
		color: 0xa3d8ff,
		transparent: true,
		opacity: 0.6,
		roughness: 0.1,
		metalness: 0.1
	});
	const matLiquid1 = new THREE.MeshBasicMaterial({ color: 0x6c5ce7 });
	const matLiquid2 = new THREE.MeshBasicMaterial({ color: 0x00b894 });
	const matRack = new THREE.MeshLambertMaterial({ color: 0xb2875a });

	const group = new THREE.Group();

	const rack = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.5), matRack);
	rack.position.y = 0.5;
	rack.castShadow = true;
	group.add(rack);

	const liquids = [matLiquid1, matLiquid2, matLiquid1];
	for (let i = 0; i < 3; i++) {
		const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 1.2, 8, 1, true), matGlass);
		tube.position.set(-0.4 + i * 0.4, 0, 0);
		tube.castShadow = true;
		group.add(tube);

		const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), matGlass);
		bottom.position.set(-0.4 + i * 0.4, -0.6, 0);
		group.add(bottom);

		const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.4 + i * 0.15, 8), liquids[i]);
		liquid.position.set(-0.4 + i * 0.4, -0.3, 0);
		group.add(liquid);
	}

	return group;
}

function buildCoffeeMug(): THREE.Object3D {
	const matCeramic = new THREE.MeshLambertMaterial({ color: 0xf5f0eb });
	const matCoffee = new THREE.MeshLambertMaterial({ color: 0x4a2c2a });
	const matHandle = new THREE.MeshLambertMaterial({ color: 0xf5f0eb });

	const mug = new THREE.Group();

	const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.45, 0.9, 16), matCeramic);
	body.castShadow = true;
	mug.add(body);

	const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), matCoffee);
	coffee.rotation.x = -Math.PI / 2;
	coffee.position.y = 0.4;
	mug.add(coffee);

	const handle = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.06, 8, 12, Math.PI), matHandle);
	handle.position.set(0.55, 0.05, 0);
	handle.rotation.z = Math.PI / 2;
	mug.add(handle);

	return mug;
}

function buildTrophy(): THREE.Object3D {
	const matGold = new THREE.MeshPhongMaterial({ color: 0xfdcb6e, shininess: 100 });
	const matBase = new THREE.MeshLambertMaterial({ color: 0x2d3436 });

	const trophy = new THREE.Group();

	const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.3, 16), matBase);
	base.position.y = -0.6;
	base.castShadow = true;
	trophy.add(base);

	const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.6, 8), matGold);
	stem.position.y = -0.15;
	trophy.add(stem);

	const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.25, 0.7, 16), matGold);
	cup.position.y = 0.5;
	cup.castShadow = true;
	trophy.add(cup);

	const handleL = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 12, Math.PI), matGold);
	handleL.position.set(-0.6, 0.5, 0);
	handleL.rotation.z = -Math.PI / 2;
	trophy.add(handleL);

	const handleR = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 12, Math.PI), matGold);
	handleR.position.set(0.6, 0.5, 0);
	handleR.rotation.z = Math.PI / 2;
	trophy.add(handleR);

	return trophy;
}

/** Custom mesh builders for prop types not available as action props */
const CUSTOM_BUILDERS: Partial<Record<ScenePropType, () => THREE.Object3D>> = {
	book: buildBook,
	clipboard: buildClipboard,
	wrench: buildWrench,
	test_tubes: buildTestTubes,
	coffee_mug: buildCoffeeMug,
	trophy: buildTrophy
};

/**
 * Build a 3D mesh for a scene prop type.
 * Reuses action prop meshes where possible, falls back to custom builders.
 */
export function buildScenePropMesh(type: ScenePropType): THREE.Object3D {
	const actionName = ACTION_MESH_REUSE[type];
	if (actionName) {
		const propDef = actionPropDefs.get(actionName);
		if (propDef) {
			return propDef.buildMesh();
		}
	}
	const builder = CUSTOM_BUILDERS[type];
	if (builder) {
		return builder();
	}
	return new THREE.Mesh(
		new THREE.BoxGeometry(1, 1, 1),
		new THREE.MeshLambertMaterial({ color: 0xff9f43 })
	);
}

// ─── Scene Props Manager ────────────────────────────────────────────────────

export type ScenePropsManager = {
	props: Map<string, ScenePropPlacement>;
	add(id: string, type: ScenePropType, worldX: number, worldZ: number, autoInteract: boolean, label?: string): ScenePropPlacement;
	remove(id: string): void;
	getById(id: string): ScenePropPlacement | undefined;
	update(delta: number): void;
	clear(): void;
	/** Return a serializable snapshot of all placed props for state reporting */
	getSnapshot(): Array<{ id: string; type: ScenePropType; state: string; worldX: number; worldZ: number }>;
};

/** Overshoot ease for a "pop" spawn effect */
function smoothPopIn(p: number): number {
	const c = 1.70158;
	return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
}

export function createScenePropsManager(scene: THREE.Scene): ScenePropsManager {
	const props = new Map<string, ScenePropPlacement>();
	let elapsedTime = 0;
	const glowColor = new THREE.Color(0x88ccff);

	return {
		props,

		add(id, type, worldX, worldZ, autoInteract, label) {
			// Remove existing prop with same id
			const existing = props.get(id);
			if (existing) {
				scene.remove(existing.mesh);
				props.delete(id);
			}

			const mesh = buildScenePropMesh(type);
			mesh.position.set(worldX, GROUND_Y, worldZ);
			mesh.rotation.set(-Math.PI / 2, 0, Math.random() * 0.4 - 0.2);
			mesh.scale.set(0, 0, 0);
			mesh.visible = true;
			scene.add(mesh);

			const placement: ScenePropPlacement = {
				id,
				type,
				label,
				mesh,
				state: 'spawning',
				worldX,
				worldZ,
				spawnProgress: 0,
				despawnProgress: 0,
				autoInteract
			};
			props.set(id, placement);
			return placement;
		},

		remove(id) {
			const prop = props.get(id);
			if (!prop) {
				return;
			}
			if (prop.state === 'despawning') {
				return;
			}
			prop.state = 'despawning';
			prop.despawnProgress = 0;
		},

		getById(id) {
			return props.get(id);
		},

		update(delta) {
			elapsedTime += delta;
			for (const [id, prop] of props) {
				if (prop.state === 'spawning') {
					prop.spawnProgress = Math.min(1, prop.spawnProgress + delta * 2.5);
					const s = smoothPopIn(prop.spawnProgress);
					prop.mesh.scale.set(s, s, s);
					if (prop.spawnProgress >= 1) {
						prop.state = 'idle';
						prop.mesh.scale.set(1, 1, 1);
					}
				} else if (prop.state === 'idle' || prop.state === 'targeted') {
					// Gentle idle animation — subtle hover bob + slow rotation
					const phase = elapsedTime * 1.2 + prop.worldX * 0.7; // offset by position for variety
					const bob = Math.sin(phase) * 0.08;
					prop.mesh.position.y = GROUND_Y + bob;
					prop.mesh.rotation.z = Math.sin(phase * 0.6) * 0.05;
					// Soft glow pulse via emissive on first child mesh
					const firstMesh = prop.mesh instanceof THREE.Mesh
						? prop.mesh
						: prop.mesh.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh);
					if (firstMesh?.material instanceof THREE.MeshLambertMaterial || firstMesh?.material instanceof THREE.MeshStandardMaterial || firstMesh?.material instanceof THREE.MeshPhongMaterial) {
						const pulse = (Math.sin(phase * 1.5) * 0.5 + 0.5) * 0.08;
						(firstMesh.material as THREE.MeshLambertMaterial).emissiveIntensity = pulse;
						if (!(firstMesh.material as THREE.MeshLambertMaterial).emissive.equals(glowColor)) {
							(firstMesh.material as THREE.MeshLambertMaterial).emissive.copy(glowColor);
						}
					}
				} else if (prop.state === 'despawning') {
					prop.despawnProgress = Math.min(1, prop.despawnProgress + delta * 3);
					const s = 1 - prop.despawnProgress;
					prop.mesh.scale.set(s, s, s);
					if (prop.despawnProgress >= 1) {
						scene.remove(prop.mesh);
						props.delete(id);
					}
				} else if (prop.state === 'grabbed') {
					prop.mesh.scale.lerp(new THREE.Vector3(0, 0, 0), 0.15);
					if (prop.mesh.scale.x < 0.02) {
						scene.remove(prop.mesh);
						props.delete(id);
					}
				}
			}
		},

		clear() {
			for (const [, prop] of props) {
				scene.remove(prop.mesh);
			}
			props.clear();
		},

		getSnapshot() {
			return Array.from(props.values()).map(p => ({
				id: p.id,
				type: p.type,
				state: p.state,
				worldX: p.worldX,
				worldZ: p.worldZ
			}));
		}
	};
}
