import * as assert from 'assert';
import { MoodInterpreter, type Personality, type RobotReaction } from '../services/mood-interpreter';
import type { WorkspaceVibe, GitState } from '../services/workspace-vibe-service';

/**
 * Baseline tests for MoodInterpreter heuristics (Phases 4 & 6 touch this file).
 * Tests target deterministic behavior only — random message/mood selection is
 * asserted via set membership, never exact values.
 */

function makeVibe(stressScore: number, opts: { gitState?: GitState; deletionSpike?: boolean; errorCount?: number } = {}): WorkspaceVibe {
	return {
		stressScore,
		errorCount: opts.errorCount ?? 0,
		warningCount: 0,
		timeSinceLastSaveMs: 0,
		contextSwitchRate: 0,
		typingIntensity: 0,
		deletionSpike: opts.deletionSpike ?? false,
		gitState: opts.gitState ?? 'clean',
		summary: '',
		timestamp: Date.now()
	};
}

suite('mood-interpreter', () => {
	test('interpret returns a reaction on a vibe level change', () => {
		// initial lastVibeLevel is 'zen'; a 'focused' vibe is a level change
		const interp = new MoodInterpreter();
		const r = interp.interpret(makeVibe(20));
		assert.ok(r, 'expected a reaction on first (level-changing) interpret');
	});

	test('interpret throttles consecutive same-level vibes (returns null until 5th)', () => {
		const interp = new MoodInterpreter();
		const vibe = makeVibe(20); // focused
		assert.ok(interp.interpret(vibe), 'first call (level change) should react');
		// next 4 consecutive same-level calls are throttled (consecutive 1..4)
		for (let i = 0; i < 4; i++) {
			assert.strictEqual(interp.interpret(vibe), null, `call ${i + 2} should be throttled`);
		}
	});

	test('interpret maps a conflicted git state to mood "error"', () => {
		const interp = new MoodInterpreter();
		const r = interp.interpret(makeVibe(20, { gitState: 'conflicted' }));
		assert.ok(r);
		assert.strictEqual(r!.mood, 'error');
	});

	test('interpret maps deletionSpike + high stress to mood "knocked"', () => {
		const interp = new MoodInterpreter();
		const r = interp.interpret(makeVibe(60, { deletionSpike: true }));
		assert.ok(r);
		assert.strictEqual(r!.mood, 'knocked');
	});

	test('interpret busy-level mood is drawn from the busy set', () => {
		const interp = new MoodInterpreter();
		const r = interp.interpret(makeVibe(45)); // busy (level change from zen)
		assert.ok(r);
		assert.ok(['reviewing', 'debugging'].includes(r!.mood), `unexpected busy mood: ${r!.mood}`);
	});

	test('interpret returns a valid reaction for every personality', () => {
		for (const p of ['supportive', 'sarcastic', 'stoic'] as Personality[]) {
			const interp = new MoodInterpreter();
			interp.setPersonality(p);
			const r = interp.interpret(makeVibe(45));
			assert.ok(r, `no reaction for personality ${p}`);
		}
	});

	test('interpret reaction has valid shape (duration, temperature, message)', () => {
		const interp = new MoodInterpreter();
		const r = interp.interpret(makeVibe(45)) as RobotReaction;
		assert.ok(r.durationSeconds > 0);
		assert.ok(r.temperature >= 0 && r.temperature <= 1);
		assert.ok(typeof r.message === 'string' && r.message.length > 0);
	});

	test('celebrate always returns success with fixed duration/temperature', () => {
		const interp = new MoodInterpreter();
		const r = interp.celebrate('All errors cleared!');
		assert.strictEqual(r.mood, 'success');
		assert.strictEqual(r.durationSeconds, 4);
		assert.strictEqual(r.temperature, 0.85);
		assert.ok(r.message.length > 0);
	});

	test('welcomeBack mood depends on stress level', () => {
		const interp = new MoodInterpreter();
		assert.strictEqual(interp.welcomeBack(makeVibe(90)).mood, 'error'); // overwhelmed
		assert.strictEqual(interp.welcomeBack(makeVibe(60)).mood, 'thinking'); // stressed
		assert.strictEqual(interp.welcomeBack(makeVibe(5)).mood, 'wave'); // zen
	});
});
