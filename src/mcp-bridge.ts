import * as fs from 'fs';
import * as path from 'path';
import type { PetAction } from './pet-mood-service';

export const MCP_COMMAND_FILE = 'mcp-robot-command.json';
export const MCP_STATE_FILE = 'mcp-robot-state.json';

export type RobotControlState = {
	mood?: PetAction;
	autopilotEnabled: boolean;
	sceneProps?: Array<{ id: string; type: string; label?: string; state: string }>;
	updatedAt: string;
};

export type ScenePropCommandEntry = {
	propId: string;
	propType: string;
	label?: string;
	position?: string;
	autoInteract?: boolean;
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
	  }
	| {
			id: string;
			type: 'setScene';
			payload: { props: ScenePropCommandEntry[] };
			requestedAt: string;
			source: 'mcp';
	  }
	| {
			id: string;
			type: 'placeSceneProp';
			payload: ScenePropCommandEntry & { durationSeconds?: number; finishBehavior?: string };
			requestedAt: string;
			source: 'mcp';
	  }
	| {
			id: string;
			type: 'removeSceneProp';
			payload: { propId: string };
			requestedAt: string;
			source: 'mcp';
	  }
	| {
			id: string;
			type: 'interactWithProp';
			payload: { propId: string; durationSeconds?: number; finishBehavior?: string };
			requestedAt: string;
			source: 'mcp';
	  };

export interface RobotControlTarget {
	setMood(payload: { mood: PetAction; message?: string; durationSeconds?: number }): void;
	setAutopilot(enabled: boolean): void;
	forceMove(target: 'front' | 'left' | 'right'): void;
	setScene(payload: { props: ScenePropCommandEntry[] }): void;
	placeSceneProp(payload: ScenePropCommandEntry & { durationSeconds?: number; finishBehavior?: string }): void;
	removeSceneProp(payload: { propId: string }): void;
	interactWithProp(payload: { propId: string; durationSeconds?: number; finishBehavior?: string }): void;
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
				case 'setScene': {
					const payload = parsed.payload as { props?: unknown[] } | undefined;
					if (!payload?.props || !Array.isArray(payload.props)) {
						return;
					}
					this.target.setScene({ props: payload.props as ScenePropCommandEntry[] });
					break;
				}
				case 'placeSceneProp': {
					const payload = parsed.payload as (ScenePropCommandEntry & { durationSeconds?: number; finishBehavior?: string }) | undefined;
					if (!payload?.propId || !payload?.propType) {
						return;
					}
					this.target.placeSceneProp(payload);
					break;
				}
				case 'removeSceneProp': {
					const payload = parsed.payload as { propId?: string } | undefined;
					if (!payload?.propId) {
						return;
					}
					this.target.removeSceneProp({ propId: payload.propId });
					break;
				}
				case 'interactWithProp': {
					const payload = parsed.payload as { propId?: string; durationSeconds?: number; finishBehavior?: string } | undefined;
					if (!payload?.propId) {
						return;
					}
					this.target.interactWithProp({ propId: payload.propId, durationSeconds: payload.durationSeconds, finishBehavior: payload.finishBehavior });
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
