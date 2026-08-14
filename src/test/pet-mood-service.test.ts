import * as assert from 'assert';
import { PET_ACTIONS, SCENE_PROP_TYPES, SCENE_POSITIONS, type PetAction } from '../domain/actions';
import { PetMoodService, type PetMoodPayload } from '../services/pet-mood-service';

/**
 * Baseline tests for the canonical domain vocabulary + PetMoodService.
 * Guards Phases 1 & 6 (mcp-bridge split, services/ move, domain/actions.ts split)
 * and the "PET_ACTIONS must not drift" rule.
 */

suite('pet-mood-service', () => {
	test('PET_ACTIONS is non-empty and has no duplicates', () => {
		assert.ok(PET_ACTIONS.length > 0);
		assert.strictEqual(new Set(PET_ACTIONS).size, PET_ACTIONS.length);
	});

	test('PET_ACTIONS contains the canonical action set', () => {
		for (const a of ['idle', 'thinking', 'coding', 'debugging', 'reviewing', 'refactoring', 'testing', 'reading', 'success', 'error', 'sleep', 'sit', 'laydown', 'rest', 'running', 'walk', 'wave', 'stretch', 'dance', 'lookaround', 'shrug', 'peek', 'knocked', 'inspect']) {
			assert.ok(PET_ACTIONS.includes(a as PetAction), `missing action: ${a}`);
		}
	});

	test('SCENE_PROP_TYPES is non-empty and has no duplicates', () => {
		assert.ok(SCENE_PROP_TYPES.length > 0);
		assert.strictEqual(new Set(SCENE_PROP_TYPES).size, SCENE_PROP_TYPES.length);
		for (const t of ['paper', 'laptop', 'star', 'trophy', 'coffee_mug']) {
			assert.ok(SCENE_PROP_TYPES.includes(t as (typeof SCENE_PROP_TYPES)[number]), `missing prop type: ${t}`);
		}
	});

	test('SCENE_POSITIONS is non-empty and has no duplicates', () => {
		assert.ok(SCENE_POSITIONS.length > 0);
		assert.strictEqual(new Set(SCENE_POSITIONS).size, SCENE_POSITIONS.length);
		for (const p of ['left', 'center', 'right', 'front', 'back']) {
			assert.ok(SCENE_POSITIONS.includes(p as (typeof SCENE_POSITIONS)[number]), `missing position: ${p}`);
		}
	});

	test('PetMoodService invokes the callback with the exact payload', () => {
		const received: PetMoodPayload[] = [];
		const svc = new PetMoodService((p) => received.push(p));
		const payload: PetMoodPayload = { mood: 'wave', message: 'hi', durationSeconds: 3, temperature: 0.5 };
		svc.setPetMood(payload);
		assert.strictEqual(received.length, 1);
		assert.deepStrictEqual(received[0], payload);
	});

	test('PetMoodService start/stop/dispose are idempotent and do not throw', () => {
		const svc = new PetMoodService(() => undefined);
		assert.doesNotThrow(() => svc.start());
		assert.doesNotThrow(() => svc.start()); // double start
		assert.doesNotThrow(() => svc.stop());
		assert.doesNotThrow(() => svc.stop()); // double stop
		assert.doesNotThrow(() => svc.dispose());
	});
});
