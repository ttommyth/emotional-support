import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { MCP_COMMAND_FILE, MCP_STATE_FILE, type RobotControlCommand, type RobotControlState } from './bridge/mcp-protocol';
import { PET_ACTIONS, SCENE_PROP_TYPES, SCENE_POSITIONS } from './domain/actions';

const EMOTIONS = PET_ACTIONS.join(', ');

const BRIDGE_DIR = process.env.EMOTIONAL_SUPPORT_BRIDGE_DIR;

const log = {
	info: (msg: string) => process.stdout.write(`[mcp] ${msg}\n`),
	error: (msg: string, err?: unknown) => {
		const errText = err ? ' ' + String(err) : '';
		process.stderr.write(`[mcp][ERROR] ${msg}${errText}\n`);
	}
};

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
			"Use `temperature` (0–1) to control animation intensity: 0 = very calm/slow, 0.5 = normal, 1 = hyper/energetic.\n" +
			`Allowed emotions/actions: ${EMOTIONS}`,
		inputSchema: {
			action: z.enum(PET_ACTIONS).describe('Robot action to perform.'),
			message: z.string().optional().describe('Optional message shown alongside the action.'),
			durationSeconds: z.number().positive().optional().describe('Estimated duration for the action in seconds.'),
			temperature: z.number().min(0).max(1).optional().describe('Animation temperature 0–1. 0 = very calm/slow, 0.5 = normal (default), 1 = hyper/energetic. Controls intensity of movements.')
		}
	},
	async ({ action, message, durationSeconds, temperature }) => {
		const command: RobotControlCommand = {
			id: randomUUID(),
			type: 'setMood',
			payload: { mood: action, message, durationSeconds, temperature },
			requestedAt: new Date().toISOString(),
			source: 'mcp'
		};
		await writeCommand(command);
		return {
			content: [{ type: 'text', text: `Robot action set to ${action}${temperature !== undefined ? ` (temperature: ${temperature})` : ''}.` }],
			structuredContent: { commandId: command.id, action, temperature }
		};
	}
);

server.registerTool(
	'set_scene',
	{
		title: 'Set Scene Decoration',
		description:
			"Declaratively set the full scene of ground-level props around the robot.\n" +
			"This replaces any existing scene props. Use this for setting up a complete scene.\n" +
			"Each prop can optionally trigger auto-interaction (robot walks to it and picks it up).\n" +
			"Only one prop should have autoInteract: true.\n" +
			`Available prop types: ${SCENE_PROP_TYPES.join(', ')}\n` +
			`Available positions: ${SCENE_POSITIONS.join(', ')}\n` +
			"Prop-to-action mapping: paper/book\u2192reading, laptop\u2192coding, magnifying_glass\u2192debugging, " +
			"clipboard\u2192reviewing, wrench\u2192refactoring, test_tubes\u2192testing, lightbulb\u2192thinking. " +
			"coffee_mug, star, trophy are decoration only.",
		inputSchema: {
			props: z.array(z.object({
				id: z.string().describe('Unique identifier — use a meaningful name like the filename (e.g., "utils.ts") or context (e.g., "bug-report")'),
				type: z.enum(SCENE_PROP_TYPES).describe('Type of scene prop to place'),
				label: z.string().optional().describe('Display label shown near the prop (e.g., "utils.ts", "PR #42")'),
				position: z.enum(SCENE_POSITIONS).optional().describe('Named ground position (random if omitted)'),
				autoInteract: z.boolean().optional().describe('Robot auto-walks to this prop and picks it up (default: false)')
			})).describe('Array of props to place. Replaces entire scene.')
		}
	},
	async ({ props }) => {
		const command: RobotControlCommand = {
			id: randomUUID(),
			type: 'setScene',
			payload: {
				props: props.map(p => ({
					propId: p.id,
					propType: p.type,
					label: p.label,
					position: p.position,
					autoInteract: p.autoInteract
				}))
			},
			requestedAt: new Date().toISOString(),
			source: 'mcp'
		};
		await writeCommand(command);
		return {
			content: [{ type: 'text', text: `Scene set with ${props.length} prop(s): ${props.map(p => p.type).join(', ')}.` }],
			structuredContent: { commandId: command.id, propCount: props.length }
		};
	}
);

server.registerTool(
	'place_scene_prop',
	{
		title: 'Place Scene Prop',
		description:
			"Place a single 3D prop on the ground near the robot.\n" +
			"Use this for incremental scene building without replacing the full scene.\n" +
			"If autoInteract is true, the robot will walk to the prop, bend down, pick it up, " +
			"and begin the corresponding action (e.g., paper triggers reading).\n" +
			`Available prop types: ${SCENE_PROP_TYPES.join(', ')}\n` +
			`Available positions: ${SCENE_POSITIONS.join(', ')}\n` +
			"Prop-to-action mapping: paper/book\u2192reading, laptop\u2192coding, magnifying_glass\u2192debugging, " +
			"clipboard\u2192reviewing, wrench\u2192refactoring, test_tubes\u2192testing, lightbulb\u2192thinking. " +
			"coffee_mug, star, trophy are decoration only.",
		inputSchema: {
			id: z.string().describe('Unique ID — use a meaningful name like the filename (e.g., "utils.ts") or context (e.g., "code-review")'),
			type: z.enum(SCENE_PROP_TYPES).describe('Type of prop to place'),
			label: z.string().optional().describe('Display label shown near the prop (e.g., "utils.ts", "PR #42")'),
			position: z.enum(SCENE_POSITIONS).optional().describe('Named position on ground (random if omitted)'),
			autoInteract: z.boolean().optional().describe('Robot auto-picks up this prop (default: false)'),
			durationSeconds: z.number().positive().optional().describe('Duration for the resulting action after pickup'),
			finishBehavior: z.enum(['throw_away', 'throw_up', 'put_down', 'none']).optional().describe('What robot does after the action: throw_away (angry hurl), throw_up (celebratory toss), put_down (gently place back), none (just stop). Default: none')
		}
	},
	async ({ id, type, label, position, autoInteract, durationSeconds, finishBehavior }) => {
		const command: RobotControlCommand = {
			id: randomUUID(),
			type: 'placeSceneProp',
			payload: { propId: id, propType: type, label, position, autoInteract, durationSeconds, finishBehavior },
			requestedAt: new Date().toISOString(),
			source: 'mcp'
		};
		await writeCommand(command);
		const interactMsg = autoInteract ? ' Robot will pick it up.' : '';
		return {
			content: [{ type: 'text', text: `Placed ${type} prop "${id}" on the ground.${interactMsg}` }],
			structuredContent: { commandId: command.id, propId: id, type }
		};
	}
);

server.registerTool(
	'remove_scene_prop',
	{
		title: 'Remove Scene Prop',
		description: 'Remove a specific prop from the ground scene by its ID.',
		inputSchema: {
			id: z.string().describe('ID of the scene prop to remove')
		}
	},
	async ({ id }) => {
		const command: RobotControlCommand = {
			id: randomUUID(),
			type: 'removeSceneProp',
			payload: { propId: id },
			requestedAt: new Date().toISOString(),
			source: 'mcp'
		};
		await writeCommand(command);
		return {
			content: [{ type: 'text', text: `Removing scene prop "${id}".` }],
			structuredContent: { commandId: command.id, propId: id }
		};
	}
);

server.registerTool(
	'interact_with_prop',
	{
		title: 'Interact With Scene Prop',
		description:
			"Make the robot walk to a scene prop, bend down, pick it up, and start the corresponding action.\n" +
			"The prop must already be placed in the scene via set_scene or place_scene_prop.\n" +
			"Only works for interactive props (not decoration-only like coffee_mug, star, trophy).\n" +
			"After the action finishes, use finishBehavior to control what happens: throw_away (angry), throw_up (celebrate), put_down, or none.",
		inputSchema: {
			id: z.string().describe('ID of the scene prop to interact with'),
			durationSeconds: z.number().positive().optional().describe('Duration for the resulting action after pickup'),
			finishBehavior: z.enum(['throw_away', 'throw_up', 'put_down', 'none']).optional().describe('What robot does after the action completes. Default: none')
		}
	},
	async ({ id, durationSeconds, finishBehavior }) => {
		const command: RobotControlCommand = {
			id: randomUUID(),
			type: 'interactWithProp',
			payload: { propId: id, durationSeconds, finishBehavior },
			requestedAt: new Date().toISOString(),
			source: 'mcp'
		};
		await writeCommand(command);
		return {
			content: [{ type: 'text', text: `Robot interacting with scene prop "${id}".` }],
			structuredContent: { commandId: command.id, propId: id }
		};
	}
);

server.registerTool(
	'get_robot_state',
	{
		title: 'Get Robot State',
		description:
			"Read the current state of the robot, including mood, autopilot status, " +
			"and any scene props currently placed on the ground. " +
			"Use this to understand what the robot is doing before making changes.",
		inputSchema: {}
	},
	async () => {
		const state = await readState();
		if (!state) {
			return {
				content: [{ type: 'text', text: 'Robot state unavailable (extension may not be running).' }]
			};
		}
		const lines: string[] = [
			`Mood: ${state.mood ?? 'unknown'}`,
			`Autopilot: ${state.autopilotEnabled ? 'on' : 'off'}`
		];
		if (state.sceneProps && state.sceneProps.length > 0) {
			lines.push(`Scene props (${state.sceneProps.length}):`);
			for (const p of state.sceneProps) {
				lines.push(`  - "${p.id}" (${p.type}, ${p.state})`);
			}
		} else {
			lines.push('Scene: empty (no props placed)');
		}
		return {
			content: [{ type: 'text', text: lines.join('\n') }],
			structuredContent: state
		};
	}
);

async function main() {
	if (!BRIDGE_DIR) {
		log.error('Missing EMOTIONAL_SUPPORT_BRIDGE_DIR. MCP server cannot start.');
		process.exit(1);
	}
	const transport = new StdioServerTransport();
	await server.connect(transport);
	log.info('Emotional Support MCP server running on stdio.');
}

main().catch((error) => {
	log.error('Failed to start Emotional Support MCP server:', error);
	process.exit(1);
});
