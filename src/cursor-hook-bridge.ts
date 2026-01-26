import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { PET_ACTIONS, type PetAction, type PetMoodPayload } from './pet-mood-service';

const EVENT_FILENAME = 'emotional-support-event.json';
const HOOKS_DIR = path.join('.cursor', 'hooks');
const HOOKS_CONFIG = path.join('.cursor', 'hooks.json');

const isPetAction = (value: string): value is PetAction => (PET_ACTIONS as readonly string[]).includes(value);

type CursorHookEvent = {
	id?: string;
	mood?: string;
	message?: string;
	durationSeconds?: number;
	hookEventName?: string;
	updatedAt?: string;
};

export class CursorHookBridge implements vscode.Disposable {
	private readonly watchers: fs.FSWatcher[] = [];
	private readonly readTimers = new Map<string, NodeJS.Timeout>();
	private lastEventId: string | undefined;

	constructor(
		private readonly workspaceRoots: readonly vscode.Uri[],
		private readonly onMood: (payload: PetMoodPayload) => void,
		// Additional directories to watch for events (e.g. extension globalStorage).
		private readonly extraEventDirs: string[] = [],
		private readonly output?: vscode.OutputChannel
	) {
		this.start();
	}

	public dispose() {
		this.watchers.forEach((watcher) => watcher.close());
		this.readTimers.forEach((timer) => clearTimeout(timer));
		this.readTimers.clear();
	}

	private start() {
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
			if (typeof parsed.mood !== 'string' || !isPetAction(parsed.mood)) {
				return;
			}

			this.lastEventId = parsed.id;
			const payload: PetMoodPayload = {
				mood: parsed.mood,
				message: typeof parsed.message === 'string' ? parsed.message : undefined,
				durationSeconds: typeof parsed.durationSeconds === 'number' ? parsed.durationSeconds : undefined
			};
			this.onMood(payload);
		} catch {
			return;
		}
	}
}
