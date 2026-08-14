import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { McpBridge } from '../bridge/mcp-bridge';
import {
	MCP_COMMAND_FILE,
	MCP_STATE_FILE,
	type RobotControlState,
	type RobotControlTarget,
	type ScenePropCommandEntry
} from '../bridge/mcp-protocol';
import type { PetAction } from '../domain/actions';

/**
 * Baseline tests for the McpBridge file protocol (Phase 1 splits this file
 * into mcp-protocol.ts + mcp-bridge.ts — these tests must keep passing).
 * Runs against a temp directory, so no real extension state is touched.
 */

class MockTarget implements RobotControlTarget {
	public setMoodCalls: Array<{ mood: string; message?: string; durationSeconds?: number }> = [];
	public setAutopilotCalls: Array<{ enabled: boolean }> = [];
	public forceMoveCalls: Array<{ target: 'front' | 'left' | 'right' }> = [];
	public setSceneCalls: Array<{ props: ScenePropCommandEntry[] }> = [];
	public state: RobotControlState = { mood: 'idle', autopilotEnabled: true, updatedAt: new Date().toISOString() };

	public setMood(p: { mood: PetAction; message?: string; durationSeconds?: number }) {
		this.setMoodCalls.push({ mood: p.mood, message: p.message, durationSeconds: p.durationSeconds });
	}
	public setAutopilot(enabled: boolean) {
		this.setAutopilotCalls.push({ enabled });
	}
	public forceMove(target: 'front' | 'left' | 'right') {
		this.forceMoveCalls.push({ target });
	}
	public setScene(payload: { props: ScenePropCommandEntry[] }) {
		this.setSceneCalls.push(payload);
	}
	public placeSceneProp() {
		/* no-op for this baseline test */
	}
	public removeSceneProp() {
		/* no-op */
	}
	public interactWithProp() {
		/* no-op */
	}
	public getState(): RobotControlState {
		return this.state;
	}
}

function tempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), 'emotionsupport-test-'));
}

async function waitFor(cond: () => boolean, timeoutMs = 4000): Promise<void> {
	const start = Date.now();
	while (!cond()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error('waitFor timed out');
		}
		await new Promise((r) => setTimeout(r, 25));
	}
}

suite('mcp-bridge', () => {
	let dir: string;
	let target: MockTarget;
	let bridge: McpBridge;

	suiteSetup(() => {
		dir = tempDir();
	});

	setup(() => {
		target = new MockTarget();
		bridge = new McpBridge(dir, target);
	});

	teardown(() => {
		bridge.dispose();
	});

	suiteTeardown(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	test('bridge filenames match the documented protocol', () => {
		assert.strictEqual(MCP_COMMAND_FILE, 'mcp-robot-command.json');
		assert.strictEqual(MCP_STATE_FILE, 'mcp-robot-state.json');
	});

	test('constructor creates both bridge files', () => {
		assert.ok(fs.existsSync(path.join(dir, MCP_COMMAND_FILE)), 'command file missing');
		assert.ok(fs.existsSync(path.join(dir, MCP_STATE_FILE)), 'state file missing');
	});

	test('publishState writes the target state as JSON', () => {
		target.state = { mood: 'thinking', autopilotEnabled: false, updatedAt: '2026-01-01T00:00:00.000Z' };
		bridge.publishState(target.getState());
		const raw = JSON.parse(fs.readFileSync(path.join(dir, MCP_STATE_FILE), 'utf8'));
		assert.strictEqual(raw.mood, 'thinking');
		assert.strictEqual(raw.autopilotEnabled, false);
		assert.strictEqual(raw.updatedAt, '2026-01-01T00:00:00.000Z');
	});

	test('a setMood command file drives the target', async () => {
		const cmd = {
			id: 'test-1',
			type: 'setMood',
			payload: { mood: 'wave', message: 'hi', durationSeconds: 3 },
			requestedAt: new Date().toISOString(),
			source: 'mcp'
		};
		fs.writeFileSync(path.join(dir, MCP_COMMAND_FILE), JSON.stringify(cmd), 'utf8');
		await waitFor(() => target.setMoodCalls.length === 1);
		assert.deepStrictEqual(target.setMoodCalls[0], { mood: 'wave', message: 'hi', durationSeconds: 3 });
	});

	test('a setAutopilot command file drives the target', async () => {
		const cmd = {
			id: 'test-2',
			type: 'setAutopilot',
			payload: { enabled: false },
			requestedAt: new Date().toISOString(),
			source: 'mcp'
		};
		fs.writeFileSync(path.join(dir, MCP_COMMAND_FILE), JSON.stringify(cmd), 'utf8');
		await waitFor(() => target.setAutopilotCalls.length === 1);
		assert.deepStrictEqual(target.setAutopilotCalls[0], { enabled: false });
	});

	test('a forceMove command file drives the target', async () => {
		const cmd = {
			id: 'test-3',
			type: 'forceMove',
			payload: { target: 'left' },
			requestedAt: new Date().toISOString(),
			source: 'mcp'
		};
		fs.writeFileSync(path.join(dir, MCP_COMMAND_FILE), JSON.stringify(cmd), 'utf8');
		await waitFor(() => target.forceMoveCalls.length === 1);
		assert.deepStrictEqual(target.forceMoveCalls[0], { target: 'left' });
	});

	test('a setScene command file drives the target', async () => {
		const cmd = {
			id: 'test-4',
			type: 'setScene',
			payload: { props: [{ propId: 'a', propType: 'paper' }] },
			requestedAt: new Date().toISOString(),
			source: 'mcp'
		};
		fs.writeFileSync(path.join(dir, MCP_COMMAND_FILE), JSON.stringify(cmd), 'utf8');
		await waitFor(() => target.setSceneCalls.length === 1);
		assert.deepStrictEqual(target.setSceneCalls[0], { props: [{ propId: 'a', propType: 'paper' }] });
	});

	test('re-writing the same command id is ignored', async () => {
		const cmd = {
			id: 'test-5',
			type: 'setMood',
			payload: { mood: 'wave' },
			requestedAt: new Date().toISOString(),
			source: 'mcp'
		};
		fs.writeFileSync(path.join(dir, MCP_COMMAND_FILE), JSON.stringify(cmd), 'utf8');
		await waitFor(() => target.setMoodCalls.length === 1);
		// force a second watcher tick by touching the file with the same content
		fs.writeFileSync(path.join(dir, MCP_COMMAND_FILE), JSON.stringify(cmd), 'utf8');
		await new Promise((r) => setTimeout(r, 250));
		assert.strictEqual(target.setMoodCalls.length, 1, 'duplicate id must be ignored');
	});

	test('a malformed command is ignored without crashing', async () => {
		fs.writeFileSync(path.join(dir, MCP_COMMAND_FILE), 'not json', 'utf8');
		await new Promise((r) => setTimeout(r, 250));
		assert.strictEqual(target.setMoodCalls.length, 0);
	});
});
