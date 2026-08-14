import type { PetAction } from '../domain/actions';

/**
 * File-based MCP bridge protocol — shared between the extension host
 * (`McpBridge` watcher) and the standalone MCP server (`mcp-server.ts`).
 * Keep this file free of any `vscode` dependency so the MCP server
 * can import it as a standalone Node process.
 */

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
			payload: { mood: PetAction; message?: string; durationSeconds?: number; temperature?: number };
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
	setMood(payload: { mood: PetAction; message?: string; durationSeconds?: number; temperature?: number }): void;
	setAutopilot(enabled: boolean): void;
	forceMove(target: 'front' | 'left' | 'right'): void;
	setScene(payload: { props: ScenePropCommandEntry[] }): void;
	placeSceneProp(payload: ScenePropCommandEntry & { durationSeconds?: number; finishBehavior?: string }): void;
	removeSceneProp(payload: { propId: string }): void;
	interactWithProp(payload: { propId: string; durationSeconds?: number; finishBehavior?: string }): void;
	getState(): RobotControlState;
}
