import * as fs from 'fs';
import * as path from 'path';
import type * as vscode from 'vscode';
import type { PetAction, PetMoodPayload } from './pet-mood-service';

/**
 * Known Copilot Chat extension storage directory names within
 * `<workspaceStorage>/<hash>/`.
 */
const COPILOT_CHAT_DIRS = ['github.copilot-chat'];

/** Cursor stores chat state inside this SQLite database. */
const CURSOR_VSCDB = 'state.vscdb';

/** Minimum time between mood emissions (ms). */
const EMIT_DEBOUNCE_MS = 5_000;

// ─── Internal types ───────────────────────────────────────────────────────

type DetectedActivity = {
	source: 'copilot' | 'cursor';
	type: 'tool_call' | 'response' | 'error' | 'active';
	toolName?: string;
	timestamp: number;
};

type Indicators = {
	hasError: boolean;
	lastToolName?: string;
	hasRecentResponse: boolean;
	isActive: boolean;
};

// ─── Service ──────────────────────────────────────────────────────────────

/**
 * Watches AI chat logs from GitHub Copilot and Cursor to detect
 * developer ↔ AI interaction patterns and emit corresponding moods.
 *
 * - **Copilot**: watches JSON files under
 *   `<workspaceStorage>/<hash>/github.copilot-chat/` for tool-call and
 *   response patterns.
 * - **Cursor**: watches `state.vscdb` modification time as a simple
 *   activity indicator (the SQLite contents are not parsed).
 *
 * Disabled by default — must be enabled via the
 * `emotional-support.chatLogListening` setting.
 */
export class ChatLogWatcher implements vscode.Disposable {
	private readonly watchers: fs.FSWatcher[] = [];
	private readonly readTimers = new Map<string, NodeJS.Timeout>();
	private readonly lastCopilotContent = new Map<string, string>();
	private lastVscdbMtime = 0;
	private lastEmitTime = 0;
	private debounceTimer: NodeJS.Timeout | undefined;
	private pendingActivity: DetectedActivity | undefined;

	constructor(
		private readonly workspaceHashDir: string | undefined,
		private readonly onMood: (payload: PetMoodPayload) => void,
		private readonly output?: vscode.OutputChannel
	) {
		if (this.workspaceHashDir) {
			this.start();
		}
	}

	public dispose() {
		for (const w of this.watchers) {
			try {
				w.close();
			} catch {
				// best-effort
			}
		}
		for (const t of this.readTimers.values()) {
			clearTimeout(t);
		}
		this.readTimers.clear();
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}
	}

	// ─── Bootstrap ────────────────────────────────────────────────────

	private start() {
		this.watchCopilotSessions();
		this.watchCursorDb();
	}

	private watchCopilotSessions() {
		if (!this.workspaceHashDir) {
			return;
		}

		for (const chatDir of COPILOT_CHAT_DIRS) {
			const baseDir = path.join(this.workspaceHashDir, chatDir);
			const targets = [path.join(baseDir, 'chatSessions'), baseDir];

			for (const target of targets) {
				if (!fs.existsSync(target)) {
					continue;
				}
				try {
					const watcher = fs.watch(target, (_event, filename) => {
						try {
							if (!filename) {
								return;
							}
							const name = filename.toString();
							if (name.endsWith('.json')) {
								this.scheduleRead(path.join(target, name));
							}
						} catch {
							// best-effort — don't let watcher errors propagate
						}
					});
					this.watchers.push(watcher);
					this.output?.appendLine(`[ChatLogWatcher] Watching Copilot sessions at ${target}`);
				} catch (err) {
					this.output?.appendLine(`[ChatLogWatcher] Failed to watch ${target}: ${String(err)}`);
				}
			}
		}
	}

	private watchCursorDb() {
		if (!this.workspaceHashDir) {
			return;
		}

		const vscdbPath = path.join(this.workspaceHashDir, CURSOR_VSCDB);
		if (!fs.existsSync(vscdbPath)) {
			return;
		}

		try {
			const watcher = fs.watch(this.workspaceHashDir, (_event, filename) => {
				try {
					if (!filename || filename.toString() !== CURSOR_VSCDB) {
						return;
					}
					this.handleCursorActivity(vscdbPath);
				} catch {
					// best-effort — don't let watcher errors propagate
				}
			});
			this.watchers.push(watcher);
			this.output?.appendLine(`[ChatLogWatcher] Watching Cursor state.vscdb at ${vscdbPath}`);
		} catch (err) {
			this.output?.appendLine(`[ChatLogWatcher] Failed to watch Cursor db: ${String(err)}`);
		}
	}

	// ─── Copilot JSON parsing ─────────────────────────────────────────

	private scheduleRead(filePath: string) {
		const existing = this.readTimers.get(filePath);
		if (existing) {
			clearTimeout(existing);
		}
		this.readTimers.set(
			filePath,
			setTimeout(() => {
				this.readTimers.delete(filePath);
				void this.processCopilotFile(filePath);
			}, 200)
		);
	}

	private async processCopilotFile(filePath: string) {
		try {
			const content = await fs.promises.readFile(filePath, 'utf8');
			if (this.lastCopilotContent.get(filePath) === content) {
				return;
			}
			this.lastCopilotContent.set(filePath, content);

			const parsed: unknown = JSON.parse(content);
			const activity = this.analyzeCopilotSession(parsed);
			if (activity) {
				this.emitMood(activity);
			}
		} catch {
			// File may be mid-write or invalid — ignore silently
		}
	}

	private analyzeCopilotSession(data: unknown): DetectedActivity | null {
		const indicators = this.extractIndicators(data);

		if (indicators.hasError) {
			return { source: 'copilot', type: 'error', timestamp: Date.now() };
		}
		if (indicators.lastToolName) {
			return { source: 'copilot', type: 'tool_call', toolName: indicators.lastToolName, timestamp: Date.now() };
		}
		if (indicators.hasRecentResponse) {
			return { source: 'copilot', type: 'response', timestamp: Date.now() };
		}
		if (indicators.isActive) {
			return { source: 'copilot', type: 'active', timestamp: Date.now() };
		}
		return null;
	}

	/**
	 * Recursively scan a JSON structure for tool-call and error indicators.
	 * We keep this format-agnostic so it works regardless of exact Copilot
	 * schema version.
	 */
	private extractIndicators(data: unknown, depth = 0): Indicators {
		const result: Indicators = { hasError: false, hasRecentResponse: false, isActive: false };
		if (depth > 10 || !data) {
			return result;
		}

		if (Array.isArray(data)) {
			const recent = data.slice(-5);
			for (const item of recent) {
				this.mergeIndicators(result, this.extractIndicators(item, depth + 1));
			}
			if (data.length > 0) {
				result.isActive = true;
			}
		} else if (typeof data === 'object' && data !== null) {
			const obj = data as Record<string, unknown>;

			// Tool call arrays (various Copilot / OpenAI formats)
			const toolArray = obj['tool_calls'] ?? obj['toolCalls'] ?? obj['toolInvocations'];
			if (Array.isArray(toolArray) && toolArray.length > 0) {
				const last = toolArray[toolArray.length - 1] as Record<string, unknown> | undefined;
				result.lastToolName = this.extractToolName(last) ?? 'unknown';
			}

			// Error indicators
			if (obj['error'] || obj['status'] === 'error' || obj['status'] === 'failed') {
				result.hasError = true;
			}

			// Response indicators
			if (obj['role'] === 'assistant' || obj['kind'] === 'response' || obj['responder']) {
				result.hasRecentResponse = true;
			}

			// Recurse into well-known keys
			for (const key of ['requests', 'history', 'messages', 'turns', 'entries', 'result', 'response', 'metadata']) {
				if (obj[key]) {
					this.mergeIndicators(result, this.extractIndicators(obj[key], depth + 1));
				}
			}
		}

		return result;
	}

	private mergeIndicators(target: Indicators, source: Indicators) {
		if (source.hasError) {
			target.hasError = true;
		}
		if (source.lastToolName) {
			target.lastToolName = source.lastToolName;
		}
		if (source.hasRecentResponse) {
			target.hasRecentResponse = true;
		}
		if (source.isActive) {
			target.isActive = true;
		}
	}

	private extractToolName(entry: Record<string, unknown> | undefined): string | undefined {
		if (!entry) {
			return undefined;
		}
		if (typeof entry['toolName'] === 'string') {
			return entry['toolName'];
		}
		if (typeof entry['name'] === 'string') {
			return entry['name'];
		}
		const fn = entry['function'];
		if (fn && typeof fn === 'object' && typeof (fn as Record<string, unknown>)['name'] === 'string') {
			return (fn as Record<string, unknown>)['name'] as string;
		}
		return undefined;
	}

	// ─── Cursor state.vscdb ───────────────────────────────────────────

	private handleCursorActivity(vscdbPath: string) {
		try {
			const stat = fs.statSync(vscdbPath);
			const mtime = stat.mtimeMs;
			if (mtime <= this.lastVscdbMtime) {
				return;
			}
			this.lastVscdbMtime = mtime;

			this.emitMood({ source: 'cursor', type: 'active', timestamp: Date.now() });
		} catch {
			// ignore
		}
	}

	// ─── Mood emission ────────────────────────────────────────────────

	private emitMood(activity: DetectedActivity) {
		const now = Date.now();
		if (now - this.lastEmitTime < EMIT_DEBOUNCE_MS) {
			if (!this.debounceTimer) {
				this.pendingActivity = activity;
				this.debounceTimer = setTimeout(() => {
					this.debounceTimer = undefined;
					if (this.pendingActivity) {
						this.emitMood(this.pendingActivity);
						this.pendingActivity = undefined;
					}
				}, EMIT_DEBOUNCE_MS - (now - this.lastEmitTime));
			} else {
				this.pendingActivity = activity;
			}
			return;
		}

		this.lastEmitTime = now;
		const payload = this.activityToMood(activity);
		this.output?.appendLine(
			`[ChatLogWatcher] ${activity.source} ${activity.type}${activity.toolName ? ` (${activity.toolName})` : ''} → ${payload.mood}`
		);
		this.onMood(payload);
	}

	private activityToMood(activity: DetectedActivity): PetMoodPayload {
		if (activity.type === 'error') {
			return { mood: 'error', durationSeconds: 5 };
		}
		if (activity.type === 'tool_call' && activity.toolName) {
			return { mood: this.mapToolToAction(activity.toolName), durationSeconds: 4 };
		}
		// Generic response or activity
		return { mood: 'thinking', durationSeconds: 3 };
	}

	private mapToolToAction(toolName: string): PetAction {
		const name = toolName.toLowerCase();
		if (name.includes('edit') || name.includes('write') || name.includes('create') || name.includes('insert')) {
			return 'coding';
		}
		if (name.includes('search') || name.includes('find') || name.includes('grep') || name.includes('inspect')) {
			return 'inspect';
		}
		if (name.includes('debug') || name.includes('fix') || name.includes('diagnose')) {
			return 'debugging';
		}
		if (name.includes('test') || name.includes('run') || name.includes('exec') || name.includes('terminal')) {
			return 'testing';
		}
		if (name.includes('review') || name.includes('diff') || name.includes('compare')) {
			return 'reviewing';
		}
		if (name.includes('read') || name.includes('open') || name.includes('view') || name.includes('get')) {
			return 'reading';
		}
		if (name.includes('refactor') || name.includes('rename') || name.includes('move')) {
			return 'refactoring';
		}
		return 'thinking';
	}
}
