import * as fs from 'fs';
import * as path from 'path';
import type { PetAction } from './pet-mood-service';

export const MCP_COMMAND_FILE = 'mcp-robot-command.json';
export const MCP_STATE_FILE = 'mcp-robot-state.json';

export type RobotControlState = {
	mood?: PetAction;
	autopilotEnabled: boolean;
	updatedAt: string;
};

export type RobotControlCommand =
	| {
			id: string;
			type: 'setMood';
			payload: { mood: PetAction; message?: string; durationSeconds?: number };
			requestedAt: string;
			source: 'mcp';
	  }
	| {
			id: string;
			type: 'setAutopilot';
			payload: { enabled: boolean };
			requestedAt: string;
			source: 'mcp';
	  }
	| {
			id: string;
			type: 'forceMove';
			payload: { target: 'front' | 'left' | 'right' };
			requestedAt: string;
			source: 'mcp';
	  };

export interface RobotControlTarget {
	setMood(payload: { mood: PetAction; message?: string; durationSeconds?: number }): void;
	setAutopilot(enabled: boolean): void;
	forceMove(target: 'front' | 'left' | 'right'): void;
	getState(): RobotControlState;
}

export class McpBridge {
	private readonly commandFilePath: string;
	private readonly stateFilePath: string;
	private watcher: fs.FSWatcher | undefined;
	private lastCommandId: string | undefined;
	private readTimer: NodeJS.Timeout | undefined;

	constructor(private readonly bridgeDir: string, private readonly target: RobotControlTarget) {
		fs.mkdirSync(this.bridgeDir, { recursive: true });
		this.commandFilePath = path.join(this.bridgeDir, MCP_COMMAND_FILE);
		this.stateFilePath = path.join(this.bridgeDir, MCP_STATE_FILE);
		this.ensureFiles();
		this.startWatching();
	}

	public publishState(state: RobotControlState) {
		this.writeJson(this.stateFilePath, state);
	}

	public dispose() {
		this.watcher?.close();
		if (this.readTimer) {
			clearTimeout(this.readTimer);
		}
	}

	private ensureFiles() {
		if (!fs.existsSync(this.commandFilePath)) {
			this.writeJson(this.commandFilePath, { initialized: true, updatedAt: new Date().toISOString() });
		}
		if (!fs.existsSync(this.stateFilePath)) {
			this.publishState(this.target.getState());
		}
	}

	private startWatching() {
		this.watcher = fs.watch(this.bridgeDir, (_eventType, filename) => {
			if (!filename || filename.toString() !== MCP_COMMAND_FILE) {
				return;
			}
			this.scheduleRead();
		});
	}

	private scheduleRead() {
		if (this.readTimer) {
			clearTimeout(this.readTimer);
		}
		this.readTimer = setTimeout(() => void this.processCommandFile(), 50);
	}

	private async processCommandFile() {
		try {
			const raw = await fs.promises.readFile(this.commandFilePath, 'utf8');
			const parsed = JSON.parse(raw) as Partial<RobotControlCommand>;
			if (!parsed || typeof parsed !== 'object') {
				return;
			}
			if (typeof parsed.id !== 'string' || !parsed.id) {
				return;
			}
			if (parsed.id === this.lastCommandId) {
				return;
			}

			switch (parsed.type) {
				case 'setMood': {
					const payload = parsed.payload as RobotControlCommand['payload'];
					if (!payload || typeof (payload as { mood?: string }).mood !== 'string') {
						return;
					}
					this.target.setMood({
						mood: (payload as { mood: PetAction; message?: string; durationSeconds?: number }).mood,
						message: (payload as { message?: string }).message,
						durationSeconds: (payload as { durationSeconds?: number }).durationSeconds
					});
					break;
				}
				case 'setAutopilot': {
					const payload = parsed.payload as { enabled?: boolean } | undefined;
					if (!payload || typeof payload.enabled !== 'boolean') {
						return;
					}
					this.target.setAutopilot(payload.enabled);
					break;
				}
				case 'forceMove': {
					const payload = parsed.payload as { target?: string } | undefined;
					if (!payload || (payload.target !== 'front' && payload.target !== 'left' && payload.target !== 'right')) {
						return;
					}
					this.target.forceMove(payload.target);
					break;
				}
				default:
					return;
			}

			this.lastCommandId = parsed.id;
			this.publishState(this.target.getState());
		} catch {
			return;
		}
	}

	private writeJson(filePath: string, value: unknown) {
		fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
	}
}
