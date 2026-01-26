import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { MCP_COMMAND_FILE, MCP_STATE_FILE, type RobotControlCommand, type RobotControlState } from './mcp-bridge';
import { PET_ACTIONS } from './pet-mood-service';

const EMOTIONS = PET_ACTIONS.join(', ');

const BRIDGE_DIR = process.env.EMOTIONAL_SUPPORT_BRIDGE_DIR;

const ensureBridgeDir = async () => {
	if (!BRIDGE_DIR) {
		throw new Error('Missing EMOTIONAL_SUPPORT_BRIDGE_DIR environment variable.');
	}
	await fs.promises.mkdir(BRIDGE_DIR, { recursive: true });
};

const commandFilePath = () => {
	if (!BRIDGE_DIR) {
		throw new Error('Missing EMOTIONAL_SUPPORT_BRIDGE_DIR environment variable.');
	}
	return path.join(BRIDGE_DIR, MCP_COMMAND_FILE);
};

const stateFilePath = () => {
	if (!BRIDGE_DIR) {
		throw new Error('Missing EMOTIONAL_SUPPORT_BRIDGE_DIR environment variable.');
	}
	return path.join(BRIDGE_DIR, MCP_STATE_FILE);
};

const writeCommand = async (command: RobotControlCommand) => {
	await ensureBridgeDir();
	await fs.promises.writeFile(commandFilePath(), JSON.stringify(command, null, 2), 'utf8');
};

const readState = async (): Promise<RobotControlState | null> => {
	try {
		const raw = await fs.promises.readFile(stateFilePath(), 'utf8');
		const parsed = JSON.parse(raw) as RobotControlState;
		if (!parsed || typeof parsed !== 'object') {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
};

const server = new McpServer({
	name: 'emotional-support-robot',
	version: '0.0.1',
	title: 'Emotional Support Robot Controller'
});

server.registerTool(
	'set_robot_action',
	{
		title: 'Express Emotion',
		description:
			"Only call this tool to express a single, clear emotion from the robot.\n" +
			"Do NOT use this tool for navigation, toggling autopilot, or multi-step plans.\n" +
			"If you want the robot to return to neutral, use `action: 'idle'`.\n" +
			"Provide `durationSeconds` only as an estimated length for the expression; short, conservative values are preferred.\n" +
			`Allowed emotions/actions: ${EMOTIONS}`,
		inputSchema: {
			action: z.enum(PET_ACTIONS).describe('Robot action to perform.'),
			message: z.string().optional().describe('Optional message shown alongside the action.'),
			durationSeconds: z.number().positive().optional().describe('Estimated duration for the action in seconds.')
		}
	},
	async ({ action, message, durationSeconds }) => {
		const command: RobotControlCommand = {
			id: randomUUID(),
			type: 'setMood',
			payload: { mood: action, message, durationSeconds },
			requestedAt: new Date().toISOString(),
			source: 'mcp'
		};
		await writeCommand(command);
		return {
			content: [{ type: 'text', text: `Robot action set to ${action}.` }],
			structuredContent: { commandId: command.id, action }
		};
	}
);

async function main() {
	if (!BRIDGE_DIR) {
		console.error('Missing EMOTIONAL_SUPPORT_BRIDGE_DIR. MCP server cannot start.');
		process.exit(1);
	}
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('Emotional Support MCP server running on stdio.');
}

main().catch((error) => {
	console.error('Failed to start Emotional Support MCP server:', error);
	process.exit(1);
});
