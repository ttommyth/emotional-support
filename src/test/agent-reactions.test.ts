import * as assert from 'assert';
import type { AgentActivity, AgentActivityKind, AgentActivitySeverity } from '../services/agent-activity';
import { SessionActivityTracker } from '../services/agent-activity';
import { HeuristicAgentReactionDecider } from '../agent-reactions';

/**
 * Tests for the MCP-free agent-activity reaction system:
 * - HeuristicAgentReactionDecider maps normalized kinds to robot actions.
 * - SessionActivityTracker arbitrates between concurrent agent sessions.
 * Both are pure/deterministic, so no vscode event wiring is required.
 */

function activity(sessionId: string, kind: AgentActivityKind, timestamp: number, severity?: AgentActivitySeverity): AgentActivity {
	return { sessionId, kind, timestamp, severity };
}

suite('HeuristicAgentReactionDecider', () => {
	test('maps every activity kind to its expected robot action', () => {
		const decider = new HeuristicAgentReactionDecider();
		const expected: Record<AgentActivityKind, string> = {
			thinking: 'thinking',
			reading: 'reading',
			searching: 'inspect',
			editing: 'coding',
			testing: 'testing',
			building: 'refactoring',
			debugging: 'debugging',
			error: 'error',
			done: 'success',
			idle: 'idle'
		};
		for (const [kind, action] of Object.entries(expected)) {
			const reaction = decider.decide(activity('s1', kind as AgentActivityKind, 0));
			assert.ok(reaction, `expected a reaction for kind ${kind}`);
			assert.strictEqual(reaction.action, action, `kind ${kind} should map to ${action}`);
		}
	});

	test('reading/editing with a file detail becomes a filename callout, not a bubble', () => {
		const decider = new HeuristicAgentReactionDecider();
		const editing = decider.decide({ sessionId: 's1', kind: 'editing', detail: 'app.ts', timestamp: 0 });
		const reading = decider.decide({ sessionId: 's1', kind: 'reading', detail: 'types.ts', timestamp: 0 });
		assert.ok(editing && reading);
		assert.strictEqual(editing.bubble, 'label');
		assert.strictEqual(editing.message, 'app.ts');
		assert.strictEqual(reading.bubble, 'label');
		assert.strictEqual(reading.message, 'types.ts');
	});

	test('non-label agent reactions are silent (no speech-bubble message)', () => {
		const decider = new HeuristicAgentReactionDecider();
		const kinds: AgentActivityKind[] = ['thinking', 'searching', 'testing', 'building', 'debugging', 'error', 'done'];
		for (const kind of kinds) {
			const reaction = decider.decide(activity('s1', kind, 0));
			assert.ok(reaction, `expected a reaction for kind ${kind}`);
			assert.strictEqual(reaction.message, undefined, `${kind} should not emit a bubble message`);
			assert.strictEqual(reaction.bubble, undefined, `${kind} should not set a bubble mode`);
		}
	});

	test('errors get a longer duration than routine activity', () => {
		const decider = new HeuristicAgentReactionDecider();
		const err = decider.decide(activity('s1', 'error', 0));
		const ok = decider.decide(activity('s1', 'reading', 0));
		assert.ok(err && ok);
		assert.ok(err.durationSeconds! > ok.durationSeconds!);
	});
});

suite('SessionActivityTracker', () => {
	test('single session is dominant', () => {
		const tracker = new SessionActivityTracker();
		tracker.record(activity('a', 'editing', 1000));
		assert.strictEqual(tracker.pickDominant(2000), 'a');
	});

	test('most recently active session wins', () => {
		const tracker = new SessionActivityTracker();
		tracker.record(activity('a', 'editing', 1000));
		tracker.record(activity('b', 'thinking', 3000));
		assert.strictEqual(tracker.pickDominant(4000), 'b');
	});

	test('recent error outranks a more recent non-error session', () => {
		const tracker = new SessionActivityTracker();
		tracker.record(activity('a', 'editing', 1000));
		tracker.record(activity('b', 'error', 2000, 'error'));
		tracker.record(activity('a', 'reading', 4000));
		// session a is more recent, but session b holds a recent error → b drives
		assert.strictEqual(tracker.pickDominant(5000), 'b');
	});

	test('stale sessions are pruned', () => {
		const tracker = new SessionActivityTracker(1000, 30_000); // 1s max age
		tracker.record(activity('a', 'editing', 1000));
		assert.strictEqual(tracker.count(2500), 0);
		assert.strictEqual(tracker.pickDominant(2500), undefined);
	});

	test('session count reflects concurrent sessions', () => {
		const tracker = new SessionActivityTracker();
		tracker.record(activity('a', 'editing', 1000));
		tracker.record(activity('b', 'thinking', 2000));
		assert.strictEqual(tracker.count(3000), 2);
	});
});
