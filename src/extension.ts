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

	const isCursor = vscode.env.appName.toLowerCase().includes('cursor');
	if (isCursor) {
		// Use a global storage directory for events so we don't need to write project-level hook files.
		const globalEventDir = path.join(context.globalStorageUri.fsPath, 'cursor-events');
		const cursorHookBridge = new CursorHookBridge(
			vscode.workspace.workspaceFolders?.map((folder) => folder.uri) ?? [],
			(payload) => moodService.setPetMood(payload),
			[globalEventDir],
			getOutputChannel()
		);
		context.subscriptions.push(cursorHookBridge);
		getOutputChannel().appendLine('[CursorHookBridge] Enabled Cursor hook listener (watching global storage).');
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