import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { isAgentActivityKind, type AgentActivityKind, type AgentActivityProvider, type AgentActivitySink } from '../services/agent-activity';

const EVENT_FILENAME = 'emotional-support-event.json';
const HOOKS_DIR = path.join('.cursor', 'hooks');
const HOOKS_CONFIG = path.join('.cursor', 'hooks.json');

/** Maps Cursor hook event names to normalized agent-activity kinds. */
const HOOK_TO_KIND: Record<string, AgentActivityKind> = {
	beforeReadFile: 'reading',
	afterFileEdit: 'editing',
	afterAgentThought: 'thinking',
	beforeSubmitPrompt: 'thinking',
	postToolUseFailure: 'error',
	afterAgentResponse: 'done'
};

type CursorHookEvent = {
	id?: string;
	kind?: string;
	mood?: string;
	detail?: string;
	message?: string;
	durationSeconds?: number;
	hookEventName?: string;
	file_path?: string;
	tool_name?: string;
	error_text?: string;
	severity?: string;
	conversation_id?: string;
	generation_id?: string;
	updatedAt?: string;
};

export class CursorHookBridge implements AgentActivityProvider {
	readonly id = 'cursor-hooks';
	private sink: AgentActivitySink | undefined;
	private readonly watchers: fs.FSWatcher[] = [];
	private readonly readTimers = new Map<string, NodeJS.Timeout>();
	private lastEventId: string | undefined;

	constructor(
		private readonly workspaceRoots: readonly vscode.Uri[],
		// Additional directories to watch for events (e.g. extension globalStorage).
		private readonly extraEventDirs: string[] = [],
		private readonly output?: vscode.OutputChannel
	) {}

	start(sink: AgentActivitySink) {
		this.sink = sink;
		// Watch per-workspace project hooks if present
		this.workspaceRoots.forEach((root) => {
			try {
				const configPath = path.join(root.fsPath, HOOKS_CONFIG);
				if (!fs.existsSync(configPath)) {
					return;
				}
				const hooksDir = path.join(root.fsPath, HOOKS_DIR);
				if (!fs.existsSync(hooksDir)) {
					return;
				}
				const eventFilePath = path.join(hooksDir, EVENT_FILENAME);
				const watcher = fs.watch(hooksDir, (_eventType, filename) => {
					if (!filename || filename.toString() !== EVENT_FILENAME) {
						return;
					}
					this.scheduleRead(eventFilePath);
				});
				this.watchers.push(watcher);
				this.output?.appendLine(`[CursorHookBridge] Watching ${eventFilePath}`);
			} catch {
				// ignore per-root errors
			}
		});

		// Watch extra directories (e.g., extension global storage) so we don't require project files
		this.extraEventDirs.forEach((dir) => {
			try {
				fs.mkdirSync(dir, { recursive: true });
				const eventFilePath = path.join(dir, EVENT_FILENAME);
				// Use fs.watch on the directory where the event file will be written
				const watcher = fs.watch(dir, (_eventType, filename) => {
					if (!filename || filename.toString() !== EVENT_FILENAME) {
						return;
					}
					this.scheduleRead(eventFilePath);
				});
				this.watchers.push(watcher);
				this.output?.appendLine(`[CursorHookBridge] Watching global event path ${eventFilePath}`);
			} catch (err) {
				this.output?.appendLine(`[CursorHookBridge] Failed to watch ${dir}: ${String(err)}`);
			}
		});
	}

	dispose() {
		this.watchers.forEach((watcher) => watcher.close());
		this.readTimers.forEach((timer) => clearTimeout(timer));
		this.readTimers.clear();
		this.sink = undefined;
	}

	private scheduleRead(filePath: string) {
		const existing = this.readTimers.get(filePath);
		if (existing) {
			clearTimeout(existing);
		}
		this.readTimers.set(
			filePath,
			setTimeout(() => {
				void this.processEventFile(filePath);
			}, 60)
		);
	}

	private async processEventFile(filePath: string) {
		try {
			const raw = await fs.promises.readFile(filePath, 'utf8');
			const parsed = JSON.parse(raw) as CursorHookEvent;
			if (!parsed || typeof parsed !== 'object') {
				return;
			}
			if (typeof parsed.id !== 'string' || !parsed.id) {
				return;
			}
			if (parsed.id === this.lastEventId) {
				return;
			}

			const kind = this.toKind(parsed);
			if (!kind) {
				return;
			}

			this.lastEventId = parsed.id;
			const detail = parsed.detail || (typeof parsed.file_path === 'string' && parsed.file_path
				? path.basename(parsed.file_path)
				: undefined);
			const sessionId = [
				'cursor',
				parsed.conversation_id || parsed.id || 'unknown',
				parsed.generation_id || '0'
			].join(':');
			this.sink?.({
				sessionId,
				kind,
				detail,
				message: typeof parsed.message === 'string' ? parsed.message : undefined,
				severity: kind === 'error' ? 'error' : parsed.severity === 'warning' ? 'warning' : 'info',
				timestamp: Date.now()
			});
		} catch {
			return;
		}
	}

	private toKind(ev: CursorHookEvent): AgentActivityKind | undefined {
		if (typeof ev.kind === 'string' && isAgentActivityKind(ev.kind)) {
			return ev.kind;
		}
		if (typeof ev.hookEventName === 'string') {
			return HOOK_TO_KIND[ev.hookEventName];
		}
		return undefined;
	}
}
