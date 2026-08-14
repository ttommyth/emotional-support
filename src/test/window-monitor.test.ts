import * as assert from 'assert';
import * as vscode from 'vscode';
import { WindowFocusMonitor } from '../window-monitor';
import { MoodInterpreter } from '../services/mood-interpreter';
import type { PetAction } from '../domain/actions';
import type { PetViewProvider } from '../webview/pet-view/PetViewProvider';
import type { WorkspaceVibeService, WorkspaceVibe } from '../services/workspace-vibe-service';

/**
 * Tests for WindowFocusMonitor (welcome-back + autopilot restore on focus).
 *
 * The monitor is unit-tested with injected `isFocused`/`now`/`reactionMinAwayMs`
 * so focus state and elapsed time can be controlled without waiting on the
 * real 30s grace period or long wind-down phase timers.
 */

const MIN_AWAY_MS = 30_000;

function makeVibe(stressScore: number): WorkspaceVibe {
	return {
		stressScore,
		errorCount: 0,
		warningCount: 0,
		timeSinceLastSaveMs: 0,
		contextSwitchRate: 0,
		typingIntensity: 0,
		deletionSpike: false,
		gitState: 'clean',
		summary: '',
		timestamp: Date.now()
	};
}

type MockProvider = {
	isReady: () => boolean;
	getState: () => { autopilotEnabled: boolean };
	setAutopilot: (enabled: boolean) => void;
	setMood: (opts: { mood: PetAction; durationSeconds?: number }) => void;
	getConfig: () => { disabledActions: string[] };
	forceMove: (target: 'front' | 'left' | 'right') => void;
};

function createHarness(stressScore: number) {
	const provider: MockProvider = {
		isReady: () => true,
		getState: () => ({ autopilotEnabled: true }),
		setAutopilot: () => {},
		setMood: () => {},
		getConfig: () => ({ disabledActions: [] }),
		forceMove: () => {}
	};
	const calls = {
		setMood: [] as Array<{ mood: string; durationSeconds?: number }>,
		setAutopilot: [] as boolean[],
		forceMove: [] as string[]
	};
	provider.setAutopilot = (enabled) => { calls.setAutopilot.push(enabled); };
	provider.setMood = (opts) => { calls.setMood.push({ mood: opts.mood, durationSeconds: opts.durationSeconds }); };
	provider.forceMove = (target) => { calls.forceMove.push(target); };

	// Nonzero base so recorded timestamps are truthy (0 would read as "no loss").
	let now = 1_000_000;
	const monitor = new WindowFocusMonitor(
		provider as unknown as PetViewProvider,
		{ getCurrentVibe: () => makeVibe(stressScore) } as unknown as WorkspaceVibeService,
		new MoodInterpreter(),
		() => {},
		{ isFocused: () => false, now: () => now, reactionMinAwayMs: MIN_AWAY_MS }
	);

	return {
		monitor,
		calls,
		advance: (ms: number) => { now += ms; },
		dispose: () => monitor.dispose()
	};
}

suite('window-focus-monitor', () => {
	let harness: ReturnType<typeof createHarness>;

	setup(() => {
		harness = createHarness(5); // zen (low-stress) vibe
	});

	teardown(() => {
		harness.dispose();
	});

	test('regain focus after a long absence restores autopilot and sends welcome-back', () => {
		harness.monitor.onWindowStateChange({ focused: false } as vscode.WindowState);
		harness.advance(MIN_AWAY_MS + 1000);
		harness.monitor.onWindowStateChange({ focused: true } as vscode.WindowState);

		// autopilot is restored on return
		assert.deepStrictEqual(harness.calls.setAutopilot, [true]);
		// welcome-back mood for a zen (low-stress) vibe is 'wave'
		assert.strictEqual(harness.calls.setMood.length, 1);
		assert.strictEqual(harness.calls.setMood[0].mood, 'wave');
		assert.ok((harness.calls.setMood[0].durationSeconds ?? 0) > 0);
	});

	test('regain focus after a short absence does NOT welcome back', () => {
		harness.monitor.onWindowStateChange({ focused: false } as vscode.WindowState);
		harness.advance(5_000);
		harness.monitor.onWindowStateChange({ focused: true } as vscode.WindowState);

		assert.deepStrictEqual(harness.calls.setMood, []);
		// autopilot is still restored on return
		assert.deepStrictEqual(harness.calls.setAutopilot, [true]);
	});

	test('regain focus with no prior loss does nothing', () => {
		harness.monitor.onWindowStateChange({ focused: true } as vscode.WindowState);
		assert.deepStrictEqual(harness.calls.setMood, []);
		assert.deepStrictEqual(harness.calls.setAutopilot, []);
	});

	test('agent activity while unfocused disables autopilot (wind-down)', () => {
		harness.monitor.onAgentActivity();
		assert.deepStrictEqual(harness.calls.setAutopilot, [false]);
	});

	test('dispose clears pending timers without throwing', () => {
		harness.monitor.onWindowStateChange({ focused: false } as vscode.WindowState);
		harness.monitor.onAgentActivity();
		harness.dispose();
		assert.ok(true);
	});
});
