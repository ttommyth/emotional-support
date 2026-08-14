import * as assert from 'assert';
import { MoodHistoryService } from '../services/mood-history-service';
import type { WorkspaceVibe } from '../services/workspace-vibe-service';

/**
 * Baseline tests for MoodHistoryService (touched by Phases 4 & 6).
 * Fully deterministic — drives record() with synthetic vibes.
 */

function makeVibe(stressScore: number, errorCount = 0, ts = Date.now()): WorkspaceVibe {
	return {
		stressScore,
		errorCount,
		warningCount: 0,
		timeSinceLastSaveMs: 0,
		contextSwitchRate: 0,
		typingIntensity: 0,
		deletionSpike: false,
		gitState: 'clean',
		summary: '',
		timestamp: ts
	};
}

suite('mood-history-service', () => {
	test('empty history produces the default summary', () => {
		const svc = new MoodHistoryService();
		const s = svc.getSummary();
		assert.strictEqual(s.averageStress, 0);
		assert.strictEqual(s.peakStress, 0);
		assert.strictEqual(s.peakErrors, 0);
		assert.strictEqual(s.totalErrorsSeen, 0);
		assert.strictEqual(s.timeInLevels.zen, 100);
		assert.strictEqual(s.vibeJourney, '🟢');
		assert.ok(s.sessionDurationMinutes >= 0);
	});

	test('record aggregates average/peak stress and error peaks', () => {
		const svc = new MoodHistoryService();
		svc.record(makeVibe(10, 0)); // zen
		svc.record(makeVibe(50, 2)); // busy
		svc.record(makeVibe(90, 5)); // overwhelmed
		const s = svc.getSummary();
		assert.strictEqual(s.averageStress, 50);
		assert.strictEqual(s.peakStress, 90);
		assert.strictEqual(s.peakErrors, 5);
		assert.strictEqual(s.totalErrorsSeen, 5);
		assert.ok(s.timeInLevels.zen > 0);
		assert.ok(s.timeInLevels.busy > 0);
		assert.ok(s.timeInLevels.overwhelmed > 0);
		assert.strictEqual(s.timeInLevels.focused, 0);
		assert.strictEqual(s.timeInLevels.stressed, 0);
	});

	test('justClearedErrors detects errorCount dropping to 0 from >=3', () => {
		const svc = new MoodHistoryService();
		assert.strictEqual(svc.justClearedErrors(), false, 'no history yet');
		svc.record(makeVibe(40, 4));
		assert.strictEqual(svc.justClearedErrors(), false, 'only one sample');
		svc.record(makeVibe(20, 0));
		assert.strictEqual(svc.justClearedErrors(), true, 'errors cleared');
	});

	test('justClearedErrors is false when previous error count < 3', () => {
		const svc = new MoodHistoryService();
		svc.record(makeVibe(40, 1));
		svc.record(makeVibe(20, 0));
		assert.strictEqual(svc.justClearedErrors(), false);
	});

	test('justRelieved detects a big stress drop', () => {
		const svc = new MoodHistoryService();
		assert.strictEqual(svc.justRelieved(), false, 'not enough history');
		svc.record(makeVibe(60));
		svc.record(makeVibe(60));
		assert.strictEqual(svc.justRelieved(), false, 'two samples not enough');
		svc.record(makeVibe(10));
		assert.strictEqual(svc.justRelieved(), true, 'stress dropped below 25');
	});

	test('justRelieved is false when stress stays high', () => {
		const svc = new MoodHistoryService();
		svc.record(makeVibe(60));
		svc.record(makeVibe(60));
		svc.record(makeVibe(40));
		assert.strictEqual(svc.justRelieved(), false);
	});

	test('stressClimbing detects strictly increasing stress above 40', () => {
		const svc = new MoodHistoryService();
		assert.strictEqual(svc.stressClimbing(), false, 'no history');
		svc.record(makeVibe(10));
		svc.record(makeVibe(20));
		svc.record(makeVibe(30));
		assert.strictEqual(svc.stressClimbing(), false, 'three samples not enough');
		svc.record(makeVibe(45));
		assert.strictEqual(svc.stressClimbing(), true, 'monotonic climb to 45');
	});

	test('stressClimbing is false when the climb plateaus or dips', () => {
		const plateau = new MoodHistoryService();
		[10, 20, 30, 40].forEach((s) => plateau.record(makeVibe(s)));
		assert.strictEqual(plateau.stressClimbing(), false, 'last value not > 40');

		const dip = new MoodHistoryService();
		[10, 30, 20, 50].forEach((s) => dip.record(makeVibe(s)));
		assert.strictEqual(dip.stressClimbing(), false, 'not monotonic');
	});
});
