import * as assert from 'assert';
import { vibeLevel, WorkspaceVibeService, type VibeLevel } from '../services/workspace-vibe-service';

/**
 * Baseline tests for the vibe system (touched by Phases 4 & 6).
 * vibeLevel() is pure; WorkspaceVibeService.getCurrentVibe() is exercised
 * without start() so no vscode event wiring is required.
 */

suite('workspace-vibe-service', () => {
	test('vibeLevel maps stress scores to levels at the documented thresholds', () => {
		const cases: Array<[number, VibeLevel]> = [
			[0, 'zen'],
			[14, 'zen'],
			[15, 'focused'],
			[34, 'focused'],
			[35, 'busy'],
			[54, 'busy'],
			[55, 'stressed'],
			[74, 'stressed'],
			[75, 'overwhelmed'],
			[100, 'overwhelmed']
		];
		for (const [score, level] of cases) {
			assert.strictEqual(vibeLevel(score), level, `score ${score} should be ${level}`);
		}
	});

	test('getCurrentVibe returns a well-formed default vibe without start()', () => {
		const svc = new WorkspaceVibeService(() => undefined);
		const vibe = svc.getCurrentVibe();
		assert.strictEqual(vibe.stressScore, 0);
		assert.strictEqual(vibe.errorCount, 0);
		assert.strictEqual(vibe.warningCount, 0);
		assert.strictEqual(vibe.gitState, 'unknown');
		assert.strictEqual(vibe.deletionSpike, false);
		assert.strictEqual(vibe.summary, 'All clear – smooth sailing.');
		assert.ok(typeof vibe.timestamp === 'number');
		assert.ok(vibe.timeSinceLastSaveMs >= 0);
	});

	test('updateConfig accepts a highErrorThreshold and does not throw', () => {
		const svc = new WorkspaceVibeService(() => undefined);
		assert.doesNotThrow(() => svc.updateConfig({ highErrorThreshold: 20 }));
		assert.doesNotThrow(() => svc.updateConfig({}));
	});

	test('dispose is safe on a non-started service', () => {
		const svc = new WorkspaceVibeService(() => undefined);
		assert.doesNotThrow(() => svc.dispose());
	});
});
