// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { McpBridge, RobotControlState } from './mcp-bridge';
import { CursorHookBridge } from './cursor-hook-bridge';
import { PetAction, PetMoodService } from './pet-mood-service';

let outputChannel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel('Emotional Support');
	}
	return outputChannel;
}

const IDLE_ACTIONS: PetAction[] = ['idle', 'stretch', 'dance', 'lookaround', 'shrug', 'wave', 'sleep', 'walk'];
const CODING_ACTIONS: PetAction[] = [
	'thinking',
	'coding',
	'debugging',
	'reviewing',
	'refactoring',
	'testing',
	'reading',
	'success',
	'error'
];
const SPECIAL_ACTIONS: PetAction[] = ['peek', 'knocked'];
const PET_ACTIONS: PetAction[] = [...IDLE_ACTIONS, ...CODING_ACTIONS, ...SPECIAL_ACTIONS];

const isPetAction = (value: string): value is PetAction => PET_ACTIONS.includes(value as PetAction);

export function activate(context: vscode.ExtensionContext) {
	const petViewProvider = new PetViewProvider(context.extensionUri);
	const mcpBridge = new McpBridge(context.globalStorageUri.fsPath, petViewProvider);
	context.subscriptions.push(mcpBridge);
	petViewProvider.setStateChangeHandler((state) => mcpBridge.publishState(state));
	mcpBridge.publishState(petViewProvider.getState());
	const isDevMode = context.extensionMode === vscode.ExtensionMode.Development;
	vscode.commands.executeCommand('setContext', 'emotional-support.isDev', isDevMode);

	const moodService = new PetMoodService((payload) => {
		petViewProvider.setMood(payload);
	});

	// Window focus monitoring for behavior adjustments
	let windowFocusTimer: NodeJS.Timeout | undefined;
	let lastFocusLostTime: number | undefined;
	const UNFOCUSED_SLEEP_DELAY_MS = 120000; // 2 minutes
	const UNFOCUSED_WALK_AWAY_DELAY_MS = 180000; // 3 minutes

	const handleWindowStateChange = () => {
		const isFocused = vscode.window.state.focused;
		
		if (!isFocused) {
			// Window lost focus
			if (!lastFocusLostTime) {
				lastFocusLostTime = Date.now();
			}
			
			// Clear any existing timer
			if (windowFocusTimer) {
				clearTimeout(windowFocusTimer);
			}
			
			// Set timer to trigger sleep behavior after delay
			windowFocusTimer = setTimeout(() => {
				if (petViewProvider.isReady() && !vscode.window.state.focused) {
					const elapsedTime = Date.now() - (lastFocusLostTime ?? Date.now());
					
					if (elapsedTime >= UNFOCUSED_WALK_AWAY_DELAY_MS) {
						// Walk away behavior - robot moves around and sleeps
						petViewProvider.setMood({ 
							mood: 'walk', 
							message: 'Window inactive - walking away',
							durationSeconds: 3
						});
						
						// Then sleep
						setTimeout(() => {
							if (!vscode.window.state.focused && petViewProvider.isReady()) {
								petViewProvider.setMood({ 
									mood: 'sleep', 
									message: 'Window inactive - sleeping'
								});
							}
						}, 3000);
					} else if (elapsedTime >= UNFOCUSED_SLEEP_DELAY_MS) {
						// Just sleep
						petViewProvider.setMood({ 
							mood: 'sleep', 
							message: 'Window inactive - sleeping'
						});
					}
				}
			}, UNFOCUSED_SLEEP_DELAY_MS);
			
			getOutputChannel().appendLine(`[WindowMonitor] Window lost focus at ${new Date().toISOString()}`);
		} else {
			// Window gained focus
			if (lastFocusLostTime) {
				const inactiveTimeMs = Date.now() - lastFocusLostTime;
				const inactiveTimeMin = Math.floor(inactiveTimeMs / 60000);
				getOutputChannel().appendLine(`[WindowMonitor] Window regained focus after ${inactiveTimeMin} minutes inactive`);
				
				// Wake up the robot if it was sleeping
				if (petViewProvider.isReady() && petViewProvider.getCurrentMood() === 'sleep') {
					petViewProvider.setMood({ 
						mood: 'stretch', 
						message: 'Waking up!',
						durationSeconds: 3
					});
					
					// Then wave
					setTimeout(() => {
						if (petViewProvider.isReady()) {
							petViewProvider.setMood({ 
								mood: 'wave', 
								message: 'Welcome back!',
								durationSeconds: 2
							});
						}
					}, 3000);
				}
				
				lastFocusLostTime = undefined;
			}
			
			// Clear any pending timers
			if (windowFocusTimer) {
				clearTimeout(windowFocusTimer);
				windowFocusTimer = undefined;
			}
			
			getOutputChannel().appendLine(`[WindowMonitor] Window gained focus at ${new Date().toISOString()}`);
		}
	};

	// Monitor window state changes
	context.subscriptions.push(
		vscode.window.onDidChangeWindowState((state) => {
			handleWindowStateChange();
		})
	);

	// Check initial state
	handleWindowStateChange();

	context.subscriptions.push(moodService);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(PetViewProvider.viewType, petViewProvider, {
			webviewOptions: { retainContextWhenHidden: true }
		})
	);
	if (isDevMode) {
		const controlViewProvider = new PetControlViewProvider(context.extensionUri, petViewProvider);
		context.subscriptions.push(
			vscode.window.registerWebviewViewProvider(PetControlViewProvider.viewType, controlViewProvider, {
				webviewOptions: { retainContextWhenHidden: true }
			})
		);
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

	// Initialize extension OutputChannel and register show/clear commands
	getOutputChannel().appendLine(`Activated Emotional Support v${String(context.extension.packageJSON?.version ?? '0.0.0')}`);
	context.subscriptions.push(getOutputChannel());
	context.subscriptions.push(
		vscode.commands.registerCommand('emotional-support.showOutput', () => {
			getOutputChannel().show(true);
		}),
		vscode.commands.registerCommand('emotional-support.clearOutput', () => {
			getOutputChannel().clear();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('emotional-support.setPetMood', async () => {
			if (!petViewProvider.isReady()) {
				vscode.window.showInformationMessage('Open the Emotional Support view first.');
				return;
			}
			const currentMood = petViewProvider.getCurrentMood() ?? 'idle';
			const nextIndex = (PET_ACTIONS.indexOf(currentMood) + 1) % PET_ACTIONS.length;
			const nextMood = PET_ACTIONS[nextIndex];
			petViewProvider.setMood({ mood: nextMood, message: 'Demo mood update.' });
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('emotional-support.installUserHook', async () => {
			const ideName = (vscode.env.appName || '').toLowerCase();
			const isCursor = ideName.includes('cursor');
			if (!isCursor) {
				const pick = await vscode.window.showQuickPick(
					['Install for Cursor', 'Show instructions', 'Cancel'],
					{ placeHolder: 'This installer is specific to Cursor. Choose an action.' }
				);
				if (!pick || pick === 'Cancel') {
					return;
				}
				if (pick === 'Show instructions') {
					try {
						const readmePath = context.asAbsolutePath(path.join('hooks-samples', 'README.md'));
						const doc = await vscode.workspace.openTextDocument(readmePath);
						await vscode.window.showTextDocument(doc, { preview: true });
					} catch {
						vscode.window.showInformationMessage('See hooks-samples/README.md for setup instructions.');
					}
					return;
				}
				// fall through to install if user chose Install for Cursor
			}
			// Proceed with installing user-level Cursor hook
			try {
				const samplePath = context.asAbsolutePath(path.join('hooks-samples', 'user-emotional-support-hook.js'));
				const homeDir = process.env.HOME || process.env.USERPROFILE;
				if (!homeDir) {
					vscode.window.showErrorMessage('Cannot determine user home directory.');
					return;
				}
				const destDir = path.join(homeDir, '.cursor', 'hooks');
				await fs.promises.mkdir(destDir, { recursive: true });
				const destPath = path.join(destDir, 'emotional-support-hook.js');
				await fs.promises.copyFile(samplePath, destPath);
				// Try to set executable bit on POSIX systems
				try {
					if (process.platform !== 'win32') {
						await fs.promises.chmod(destPath, 0o755);
					}
				} catch {}
				// Ensure user hooks config exists
				const hooksJsonPath = path.join(homeDir, '.cursor', 'hooks.json');
				let hooksConfig: any = { version: 1, hooks: {} };
				try {
					const existing = await fs.promises.readFile(hooksJsonPath, 'utf8');
					hooksConfig = JSON.parse(existing);
				} catch {
					hooksConfig = { version: 1, hooks: {} };
				}
				// Add entries for events if not present
				const events = ['beforeReadFile', 'afterFileEdit', 'afterAgentThought', 'beforeSubmitPrompt', 'postToolUseFailure', 'afterAgentResponse'];
				hooksConfig.hooks = hooksConfig.hooks || {};
				events.forEach((e) => {
					if (!Array.isArray(hooksConfig.hooks[e])) {
						hooksConfig.hooks[e] = [];
					}
					const rel = `./hooks/emotional-support-hook.js`;
					if (!hooksConfig.hooks[e].some((h: any) => h && h.command === rel)) {
						hooksConfig.hooks[e].push({ command: rel });
					}
				});
				await fs.promises.writeFile(hooksJsonPath, JSON.stringify(hooksConfig, null, 2), 'utf8');
				vscode.window.showInformationMessage('Installed user-level Emotional Support hook to your home Cursor hooks. Restart Cursor to activate.');
			} catch (err) {
				vscode.window.showErrorMessage(`Failed to install hook: ${String(err)}`);
			}
		})
	);

	const providerId = 'emotional-support.mcp';
	context.subscriptions.push(
		vscode.lm.registerMcpServerDefinitionProvider(providerId, {
			provideMcpServerDefinitions: () => {
				const serverModule = context.asAbsolutePath(path.join('dist', 'mcp-server.js'));
				const env = {
					EMOTIONAL_SUPPORT_BRIDGE_DIR: context.globalStorageUri.fsPath
				};
				return [
					new vscode.McpStdioServerDefinition(
						'Emotional Support Robot',
						process.execPath,
						[serverModule],
						env,
						String(context.extension.packageJSON?.version ?? '0.0.0')
					)
				];
			}
		})
	);
}

export function deactivate() {}

class PetViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'emotional-support.petView';

	private view: vscode.WebviewView | undefined;
	private readonly extensionUri: vscode.Uri;
	private readonly state: { currentMood?: PetAction; autopilotEnabled: boolean } = { autopilotEnabled: true };
	private onStateChange?: (state: RobotControlState) => void;

	constructor(extensionUri: vscode.Uri) {
		this.extensionUri = extensionUri;
	}

	public setStateChangeHandler(handler: (state: RobotControlState) => void) {
		this.onStateChange = handler;
	}

	public resolveWebviewView(webviewView: vscode.WebviewView) {
		this.view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionUri]
		};
		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage((message) => {
			switch (message?.command) {
				case 'READY': {
					this.setMood({ mood: 'idle', message: 'Ready to swim.' });
					this.setAutopilot(this.state.autopilotEnabled);
					break;
				}
				case 'SET_MOOD': {
					if (typeof message?.mood === 'string' && isPetAction(message.mood)) {
						this.setMood({ mood: message.mood, message: message.message });
					}
					break;
				}
				default:
					break;
			}
		});
	}

	public isReady() {
		return Boolean(this.view);
	}

	public getCurrentMood() {
		return this.state.currentMood;
	}

	public getState(): RobotControlState {
		return {
			mood: this.state.currentMood,
			autopilotEnabled: this.state.autopilotEnabled,
			updatedAt: new Date().toISOString()
		};
	}

	public setMood(payload: { mood: PetAction; message?: string; durationSeconds?: number }) {
		this.state.currentMood = payload.mood;
		this.view?.webview.postMessage({ command: 'SET_MOOD', ...payload });
		this.onStateChange?.(this.getState());
	}

	public setAutopilot(enabled: boolean) {
		this.state.autopilotEnabled = enabled;
		this.view?.webview.postMessage({ command: 'SET_AUTOPILOT', enabled });
		this.onStateChange?.(this.getState());
	}

	public forceMove(target: 'front' | 'left' | 'right') {
		this.view?.webview.postMessage({ command: 'FORCE_MOVE', target });
	}

	private getHtmlForWebview(webview: vscode.Webview) {
		const distPath = vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist');
		const indexPath = vscode.Uri.joinPath(distPath, 'index.html');
		try {
			const rawHtml = fs.readFileSync(indexPath.fsPath, 'utf8');
			const baseUri = webview.asWebviewUri(distPath);
			const csp = [
				"default-src 'none'",
				`img-src ${webview.cspSource} data:`,
				`style-src ${webview.cspSource} 'unsafe-inline'`,
				`script-src ${webview.cspSource}`,
				`font-src ${webview.cspSource}`
			].join('; ');
			return rawHtml
				.replace('<head>', `<head>\n\t<meta http-equiv="Content-Security-Policy" content="${csp}">`)
				.replace(/(src|href)=\"\.\//g, `$1="${baseUri}/`);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Emotional Support</title>
	<style>
		body { font-family: sans-serif; padding: 16px; }
		code { background: #f2f2f2; padding: 2px 6px; border-radius: 6px; }
	</style>
</head>
<body>
	<h3>Webview UI not built yet</h3>
	<p>Run <code>npm run build:webview</code> in the extension workspace.</p>
	<p>${message}</p>
</body>
</html>`;
		}
	}
}

class PetControlViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'emotional-support.controlView';

	private view: vscode.WebviewView | undefined;
	private readonly extensionUri: vscode.Uri;
	private readonly petViewProvider: PetViewProvider;

	constructor(extensionUri: vscode.Uri, petViewProvider: PetViewProvider) {
		this.extensionUri = extensionUri;
		this.petViewProvider = petViewProvider;
	}

	public resolveWebviewView(webviewView: vscode.WebviewView) {
		this.view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionUri]
		};
		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage((message) => {
			switch (message?.command) {
				case 'FORCE_ACTION': {
					if (typeof message?.action !== 'string' || !isPetAction(message.action)) {
						return;
					}
					if (!this.petViewProvider.isReady()) {
						vscode.window.showInformationMessage('Open the Emotional Support view to control the robot.');
						return;
					}
					this.petViewProvider.setMood({
						mood: message.action,
						message: 'Forced action from control panel.'
					});
					break;
				}
				case 'SET_AUTOPILOT': {
					if (typeof message?.enabled !== 'boolean') {
						return;
					}
					if (!this.petViewProvider.isReady()) {
						vscode.window.showInformationMessage('Open the Emotional Support view to control the robot.');
						return;
					}
					this.petViewProvider.setAutopilot(message.enabled);
					break;
				}
				case 'FORCE_MOVE': {
					if (message?.target !== 'front' && message?.target !== 'left' && message?.target !== 'right') {
						return;
					}
					if (!this.petViewProvider.isReady()) {
						vscode.window.showInformationMessage('Open the Emotional Support view to control the robot.');
						return;
					}
					this.petViewProvider.forceMove(message.target);
					break;
				}
				default:
					break;
			}
		});
	}

	private getHtmlForWebview(webview: vscode.Webview) {
		const nonce = getNonce();
		const csp = [
			"default-src 'none'",
			`style-src ${webview.cspSource} 'unsafe-inline'`,
			`script-src 'nonce-${nonce}'`
		].join('; ');
		const renderButtons = (actions: PetAction[]) =>
			actions
				.map((action) => {
					const label = `${action.charAt(0).toUpperCase()}${action.slice(1)}`;
					return `<button class="btn" data-action="${action}">${label}</button>`;
				})
				.join('');
		const buttons = `
			<h4>Idle filler</h4>
			<div class="btn-group">${renderButtons(IDLE_ACTIONS)}</div>
			<h4>Coding related</h4>
			<div class="btn-group">${renderButtons(CODING_ACTIONS)}</div>
			<h4>Special</h4>
			<div class="btn-group">${renderButtons(SPECIAL_ACTIONS)}</div>
		`;

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="${csp}">
	<title>Robot Control Panel</title>
	<style>
		:root {
			color-scheme: light dark;
		}
		body {
			font-family: var(--vscode-font-family);
			color: var(--vscode-foreground);
			margin: 0;
			padding: 16px;
			background: var(--vscode-sideBar-background);
		}
		h3 {
			margin: 0 0 8px;
			font-size: 14px;
		}
		p {
			margin: 0 0 12px;
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}
		h4 {
			margin: 8px 0;
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}
		.grid {
			display: flex;
			flex-direction: column;
			gap: 10px;
		}
		.btn-group {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
			gap: 8px;
		}
		.section {
			margin-bottom: 12px;
		}
		.btn {
			border: 1px solid var(--vscode-button-border, transparent);
			border-radius: 8px;
			padding: 8px 10px;
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			cursor: pointer;
			font-size: 12px;
			text-align: center;
		}
		.btn:hover {
			background: var(--vscode-button-secondaryHoverBackground);
		}
		.btn-primary {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}
		.btn-primary:hover {
			background: var(--vscode-button-hoverBackground);
		}
		.hint {
			margin-top: 12px;
			font-size: 11px;
		}
	</style>
</head>
<body>
	<h3>Robot Control Panel</h3>
	<p>Force the robot to perform an action.</p>
	<div class="section">
		<button id="autopilot-toggle" class="btn btn-primary" type="button">Autopilot: On</button>
	</div>
	<div class="section">
		<h4>Camera peeks</h4>
		<div class="btn-group">
			<button class="btn" data-move="left" type="button">Peek Left</button>
			<button class="btn" data-move="front" type="button">Peek Front</button>
			<button class="btn" data-move="right" type="button">Peek Right</button>
		</div>
	</div>
	<div class="grid">${buttons}</div>
	<p class="hint">Open the Emotional Support view to see the action.</p>
	<script nonce="${nonce}">
		const vscode = typeof acquireVsCodeApi === 'function'
			? acquireVsCodeApi()
			: { postMessage: () => undefined };
		let autopilotEnabled = true;
		const autopilotButton = document.getElementById('autopilot-toggle');
		const updateAutopilotButton = () => {
			if (!autopilotButton) {
				return;
			}
			autopilotButton.textContent = 'Autopilot: ' + (autopilotEnabled ? 'On' : 'Off');
		};
		if (autopilotButton) {
			autopilotButton.addEventListener('click', () => {
				autopilotEnabled = !autopilotEnabled;
				updateAutopilotButton();
				vscode.postMessage({ command: 'SET_AUTOPILOT', enabled: autopilotEnabled });
			});
		}
		updateAutopilotButton();
		document.querySelectorAll('[data-action]').forEach((button) => {
			button.addEventListener('click', () => {
				const action = button.getAttribute('data-action');
				if (!action) {
					return;
				}
				vscode.postMessage({ command: 'FORCE_ACTION', action });
			});
		});
		document.querySelectorAll('[data-move]').forEach((button) => {
			button.addEventListener('click', () => {
				const target = button.getAttribute('data-move');
				if (!target) {
					return;
				}
				vscode.postMessage({ command: 'FORCE_MOVE', target });
			});
		});
	</script>
</body>
</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i += 1) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

