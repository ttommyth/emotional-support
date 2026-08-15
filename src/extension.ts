// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { McpBridge } from './bridge/mcp-bridge';
import { CursorHookBridge } from './hooks/cursor-hook-bridge';
import { PetMoodService } from './services/pet-mood-service';
import { WorkspaceVibeService } from './services/workspace-vibe-service';
import { MoodInterpreter } from './services/mood-interpreter';
import { MoodHistoryService } from './services/mood-history-service';
import { VibeReactionController } from './vibe-reactions';
import { WindowFocusMonitor } from './window-monitor';
import { registerCommands } from './commands';
import { registerMcpServer } from './mcp-registration';
import { PetViewProvider } from './webview/pet-view/PetViewProvider';
import { PetControlViewProvider } from './webview/control-view/PetControlViewProvider';
import { AgentReactionController, HeuristicAgentReactionDecider } from './agent-reactions';
import { VscodeAgentActivityMonitor } from './services/agent-activity-monitor';
import { CopilotToolProvider, COPILOT_TOOL_NAME } from './services/copilot-tool-provider';
import type { AgentActivity } from './services/agent-activity';

let outputChannel: vscode.OutputChannel | undefined;
let activeMoodHistory: MoodHistoryService | undefined;

export function getOutputChannel(): vscode.OutputChannel {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel('Emotional Support');
	}
	return outputChannel;
}

export function activate(context: vscode.ExtensionContext) {
	// Create + register the output channel EAGERLY, before any service schedules
	// timers/events. `getOutputChannel()` lazily calls createOutputChannel() on
	// first use; if that first use happened in a late async/timer callback after
	// this context's disposable store is disposed, VS Code throws
	// "Trying to add a disposable to a DisposableStore that has already been
	// disposed of". Creating it here guarantees the channel exists for the whole
	// extension lifetime, so no late callback can ever trigger createOutputChannel.
	context.subscriptions.push(getOutputChannel());
	getOutputChannel().appendLine(`Activated Emotional Support v${String(context.extension.packageJSON?.version ?? '0.0.0')}`);

	const petViewProvider = new PetViewProvider(context.extensionUri);
	const mcpBridge = new McpBridge(context.globalStorageUri.fsPath, petViewProvider);
	context.subscriptions.push(mcpBridge);
	petViewProvider.setStateChangeHandler((state) => mcpBridge.publishState(state));
	mcpBridge.publishState(petViewProvider.getState());
	const isDevMode = context.extensionMode === vscode.ExtensionMode.Development;
	vscode.commands.executeCommand('setContext', 'emotional-support.isDev', isDevMode);

	// Window focus monitoring for behavior adjustments
	let onAgentActivity: () => void = () => undefined;
	const moodService = new PetMoodService((payload) => {
		onAgentActivity();
		const { message: _message, ...rest } = payload;
		petViewProvider.setMood(rest);
	});

	// ─── Workspace Vibe System ────────────────────────────────────────────
	const moodInterpreter = new MoodInterpreter();
	const moodHistory = new MoodHistoryService();
	activeMoodHistory = moodHistory;
	const vibeReactions = new VibeReactionController(moodHistory, moodInterpreter, petViewProvider);
	const vibeService = new WorkspaceVibeService((vibe) => vibeReactions.handleVibeChange(vibe));

	// Read initial config for vibe system
	vibeService.updateConfig(vibeReactions.updateConfig());
	vibeService.start();
	context.subscriptions.push(vibeService);

	// Window focus monitoring (wind-down behavior while the window is unfocused)
	const windowFocusMonitor = new WindowFocusMonitor(
		petViewProvider,
		vibeService,
		moodInterpreter,
		(line) => getOutputChannel().appendLine(line)
	);
	onAgentActivity = () => windowFocusMonitor.onAgentActivity();

	// Monitor window state changes
	context.subscriptions.push(
		vscode.window.onDidChangeWindowState((state) => windowFocusMonitor.onWindowStateChange(state))
	);

	// Monitor configuration changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('emotional-support')) {
				petViewProvider.sendConfig();
				vibeService.updateConfig(vibeReactions.updateConfig());
				agentReactions.setEnabled(
					vscode.workspace.getConfiguration('emotional-support').get<boolean>('agentActivity.enabled', true)
				);
			}
		})
	);

	// Check initial state
	windowFocusMonitor.onWindowStateChange(vscode.window.state);

	// Cleanup timers on deactivation
	context.subscriptions.push(windowFocusMonitor);

	context.subscriptions.push(moodService);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(PetViewProvider.viewType, petViewProvider, {
			webviewOptions: { retainContextWhenHidden: true }
		})
	);
	if (isDevMode) {
		const controlViewProvider = new PetControlViewProvider(context.extensionUri, petViewProvider, vibeService, moodHistory);
		context.subscriptions.push(
			vscode.window.registerWebviewViewProvider(PetControlViewProvider.viewType, controlViewProvider, {
				webviewOptions: { retainContextWhenHidden: true }
			})
		);
	} else {
		// Register control panel when user opts in via settings
		const showControlPanel = vscode.workspace.getConfiguration('emotional-support').get<boolean>('showControlPanel', false);
		if (showControlPanel) {
			vscode.commands.executeCommand('setContext', 'emotional-support.showControlPanel', true);
			const controlViewProvider = new PetControlViewProvider(context.extensionUri, petViewProvider, vibeService, moodHistory);
			context.subscriptions.push(
				vscode.window.registerWebviewViewProvider(PetControlViewProvider.viewType, controlViewProvider, {
					webviewOptions: { retainContextWhenHidden: true }
				})
			);
		}
	}

	moodService.start();

	// ─── Agent Activity System (MCP-free) ───────────────────────────────
	// The robot reacts to what the coding agent is actually doing. All
	// providers (VS Code heuristics, the optional Copilot native tool, the
	// Cursor hook bridge) emit normalized AgentActivity into ONE controller,
	// which arbitrates between concurrent agent sessions and drives the pet.
	const agentReactions = new AgentReactionController(
		petViewProvider,
		new HeuristicAgentReactionDecider(),
		{
			enabled: vscode.workspace.getConfiguration('emotional-support').get<boolean>('agentActivity.enabled', true),
			minIntervalMs: vscode.workspace.getConfiguration('emotional-support').get<number>('agentActivity.minIntervalMs', 6000)
		}
	);
	context.subscriptions.push(agentReactions);
	const onAgentActivityEvent = (activity: AgentActivity) => agentReactions.handleActivity(activity);

	// 1) Heuristic sensor — works in any VS Code-based IDE (Copilot, Cursor, …).
	const agentActivityMonitor = new VscodeAgentActivityMonitor();
	agentActivityMonitor.start(onAgentActivityEvent);
	context.subscriptions.push(agentActivityMonitor);

	// 2) Optional native Copilot tool (agent-callable, no MCP server).
	if (vscode.workspace.getConfiguration('emotional-support').get<boolean>('agentTool.enabled', true)) {
		const copilotToolProvider = new CopilotToolProvider();
		copilotToolProvider.start(onAgentActivityEvent);
		context.subscriptions.push(copilotToolProvider);
		getOutputChannel().appendLine(`[AgentActivity] Registered Copilot tool '${COPILOT_TOOL_NAME}'.`);
	}

	const isCursor = vscode.env.appName.toLowerCase().includes('cursor');
	if (isCursor) {
		// 3) Cursor hook bridge — same pipeline, exact agent events.
		const globalEventDir = path.join(context.globalStorageUri.fsPath, 'cursor-events');
		const cursorHookBridge = new CursorHookBridge(
			vscode.workspace.workspaceFolders?.map((folder) => folder.uri) ?? [],
			[globalEventDir],
			getOutputChannel()
		);
		cursorHookBridge.start(onAgentActivityEvent);
		context.subscriptions.push(cursorHookBridge);
		getOutputChannel().appendLine('[AgentActivity] Cursor hook bridge enabled (watching global storage).');
		getOutputChannel().appendLine(
			`To avoid committing hook files to the project, place your Cursor hook script in your home hooks and have it write events to: ${globalEventDir}`
		);
	}

	// Register commands
	registerCommands(context, { petViewProvider, moodHistory, vibeService });

	// Register the MCP server definition
	registerMcpServer(context);
}

export function deactivate() {
	if (activeMoodHistory) {
		try {
			activeMoodHistory.printSummary();
		} catch {
			// The extension context (and output channel) may already be disposed
			// during shutdown — don't surface a console error for the summary write.
		}
		activeMoodHistory = undefined;
	}
}