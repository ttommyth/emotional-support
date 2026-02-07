// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { McpBridge, RobotControlState, type ScenePropCommandEntry } from './mcp-bridge';
import { CursorHookBridge } from './cursor-hook-bridge';
import { PET_ACTIONS, PetAction, PetMoodService, SCENE_PROP_TYPES, SCENE_POSITIONS } from './pet-mood-service';

let outputChannel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel('Emotional Support');
	}
	return outputChannel;
}

const isPetAction = (value: string): value is PetAction => PET_ACTIONS.includes(value as PetAction);

export function activate(context: vscode.ExtensionContext) {
	const petViewProvider = new PetViewProvider(context.extensionUri);
	const mcpBridge = new McpBridge(context.globalStorageUri.fsPath, petViewProvider);
	context.subscriptions.push(mcpBridge);
	petViewProvider.setStateChangeHandler((state) => mcpBridge.publishState(state));
	mcpBridge.publishState(petViewProvider.getState());
	const isDevMode = context.extensionMode === vscode.ExtensionMode.Development;
	vscode.commands.executeCommand('setContext', 'emotional-support.isDev', isDevMode);

	// Window focus monitoring for behavior adjustments
	let windowFocusTimer: NodeJS.Timeout | undefined;
	let followUpTimer: NodeJS.Timeout | undefined; // For multi-step behaviors
	let lastFocusLostTime: number | undefined;
	let unfocusedBackoffDelayMs = 0;
	let unfocusedBackoffStep = 0;
	let lastUnfocusedAction: PetAction | undefined;
	let lastAgentActivityTime: number | undefined;
	const UNFOCUSED_BACKOFF_BASE_MS = 15000; // 15 seconds
	const UNFOCUSED_BACKOFF_MULTIPLIER = 1.9;
	const UNFOCUSED_BACKOFF_STEPS = 3;
	const UNFOCUSED_ACTIONS: PetAction[] = [
		'lookaround',
		'stretch',
		'shrug',
		'peek',
		'walk',
		'sit',
		'rest',
		'laydownflat',
		'ballet'
	];

	const clearAllTimers = () => {
		if (windowFocusTimer) {
			clearTimeout(windowFocusTimer);
			windowFocusTimer = undefined;
		}
		if (followUpTimer) {
			clearTimeout(followUpTimer);
			followUpTimer = undefined;
		}
	};

	const startUnfocusedBehaviorCycle = (reason: string) => {
		unfocusedBackoffDelayMs = UNFOCUSED_BACKOFF_BASE_MS;
		unfocusedBackoffStep = 0;
		lastUnfocusedAction = undefined;
		clearAllTimers();

		const scheduleNextBehavior = (delay: number) => {
			windowFocusTimer = setTimeout(() => {
				if (!vscode.window.state.focused && petViewProvider.isReady()) {
					if (!lastFocusLostTime) {
						// Safety check - shouldn't happen but handle gracefully
						return;
					}

					if (unfocusedBackoffStep >= UNFOCUSED_BACKOFF_STEPS) {
						// Final stage: sleep until focus returns
						petViewProvider.setMood({
							mood: 'sleep',
							message: 'Window inactive - sleeping'
						});
						return;
					}

					const disabledActions = petViewProvider.getConfig().disabledActions;
					const enabledActions = UNFOCUSED_ACTIONS.filter(
						(action) => !disabledActions.includes(action)
					);
					if (enabledActions.length === 0) {
						// All unfocused actions disabled — sleep immediately
						petViewProvider.setMood({
							mood: 'sleep',
							message: 'Window inactive - sleeping'
						});
						return;
					}
					const nextActionOptions = enabledActions.filter(
						(action) => action !== lastUnfocusedAction
					);
					const pool = nextActionOptions.length > 0 ? nextActionOptions : enabledActions;
					const nextAction = pool[Math.floor(Math.random() * pool.length)];
					lastUnfocusedAction = nextAction;
					const durationSeconds = nextAction === 'walk' ? 3 : nextAction === 'peek' ? 1.5 : 2.2;
					petViewProvider.setMood({
						mood: nextAction,
						message: 'Window inactive - taking a break',
						durationSeconds
					});

					unfocusedBackoffStep += 1;
					unfocusedBackoffDelayMs *= UNFOCUSED_BACKOFF_MULTIPLIER;
					const jitter = 0.15;
					const jitteredDelay = unfocusedBackoffDelayMs * (1 + (Math.random() * 2 - 1) * jitter);
					scheduleNextBehavior(Math.max(2000, jitteredDelay));
				}
			}, delay);
		};

		scheduleNextBehavior(unfocusedBackoffDelayMs);
		getOutputChannel().appendLine(`[WindowMonitor] Unfocused behavior cycle restarted (${reason}) at ${new Date().toISOString()}`);
	};

	const handleWindowStateChange = (state: vscode.WindowState) => {
		const isFocused = state.focused;
		
		if (!isFocused) {
			// Window lost focus
			if (!lastFocusLostTime) {
				lastFocusLostTime = Date.now();
			}
			startUnfocusedBehaviorCycle('window-blur');
			getOutputChannel().appendLine(`[WindowMonitor] Window lost focus at ${new Date().toISOString()}`);
		} else {
			// Window gained focus
			if (lastFocusLostTime) {
				const inactiveTimeMs = Date.now() - lastFocusLostTime;
				const inactiveTimeMin = Math.floor(inactiveTimeMs / 60000);
				getOutputChannel().appendLine(`[WindowMonitor] Window regained focus after ${inactiveTimeMin} minutes inactive`);
				if (petViewProvider.isReady()) {
					petViewProvider.setAutopilot(true);
					petViewProvider.setMood({ mood: 'idle', message: 'Focus regained.' });
					if (Math.random() < 0.3) {
						petViewProvider.forceMove('front');
					}
				}
				lastFocusLostTime = undefined;
			}
			
			// Clear any pending timers
			clearAllTimers();
			
			getOutputChannel().appendLine(`[WindowMonitor] Window gained focus at ${new Date().toISOString()}`);
		}
	};

	const moodService = new PetMoodService((payload) => {
		lastAgentActivityTime = Date.now();
		if (!vscode.window.state.focused) {
			lastFocusLostTime = lastAgentActivityTime;
			if (petViewProvider.isReady()) {
				startUnfocusedBehaviorCycle('agent-activity');
			}
			getOutputChannel().appendLine(`[WindowMonitor] Agent activity detected while unfocused at ${new Date().toISOString()}`);
		}
		petViewProvider.setMood(payload);
	});

	// Monitor window state changes
	context.subscriptions.push(
		vscode.window.onDidChangeWindowState(handleWindowStateChange)
	);

	// Monitor configuration changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('emotional-support')) {
				petViewProvider.sendConfig();
			}
		})
	);

	// Check initial state
	handleWindowStateChange(vscode.window.state);

	// Cleanup timers on deactivation
	context.subscriptions.push({
		dispose: () => {
			clearAllTimers();
		}
	});

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
		vscode.commands.registerCommand('emotional-support.placeSceneProp', async () => {
			if (!petViewProvider.isReady()) {
				vscode.window.showInformationMessage('Open the Emotional Support view first.');
				return;
			}
			const propType = await vscode.window.showQuickPick(
				SCENE_PROP_TYPES.map(t => ({ label: t, description: SCENE_PROP_TYPES.indexOf(t) < 8 ? 'Interactive' : 'Decoration' })),
				{ placeHolder: 'Choose a prop type to place on the ground' }
			);
			if (!propType) return;
			const position = await vscode.window.showQuickPick(
				[...SCENE_POSITIONS, 'random'] as string[],
				{ placeHolder: 'Choose a position' }
			);
			if (!position) return;
			const autoInteract = await vscode.window.showQuickPick(
				[{ label: 'Yes', description: 'Robot walks to prop and picks it up' }, { label: 'No', description: 'Just place the prop' }],
				{ placeHolder: 'Auto-interact?' }
			);
			if (!autoInteract) return;
			const propId = `cmd-${Date.now()}`;
			petViewProvider.placeSceneProp({
				propId,
				propType: propType.label,
				position: position === 'random' ? undefined : position,
				autoInteract: autoInteract.label === 'Yes'
			});
		}),
		vscode.commands.registerCommand('emotional-support.clearScene', () => {
			if (!petViewProvider.isReady()) {
				vscode.window.showInformationMessage('Open the Emotional Support view first.');
				return;
			}
			petViewProvider.setScene({ props: [] });
			vscode.window.showInformationMessage('Scene cleared.');
		})
	);

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
	private readonly state: {
		currentMood?: PetAction;
		autopilotEnabled: boolean;
		sceneProps: Array<{ id: string; type: string; label?: string; state: string }>;
	} = { autopilotEnabled: true, sceneProps: [] };
	private onStateChange?: (state: RobotControlState) => void;

	constructor(extensionUri: vscode.Uri) {
		this.extensionUri = extensionUri;
	}

	public setStateChangeHandler(handler: (state: RobotControlState) => void) {
		this.onStateChange = handler;
	}

	public getConfig() {
		const config = vscode.workspace.getConfiguration('emotional-support');
		return {
			accentColor: config.get<string>('accentColor', '#ff9f43'),
			bodyColor: config.get<string>('bodyColor', '#ffffff'),
			visorColor: config.get<string>('visorColor', '#343a40'),
			limbColor: config.get<string>('limbColor', '#aabbaa'),
			defaultEyeColor: config.get<string>('defaultEyeColor', '#00d2d3'),
			successEyeColor: config.get<string>('successEyeColor', '#1dd1a1'),
			errorEyeColor: config.get<string>('errorEyeColor', '#ff5252'),
			idleAnimations: config.get<boolean>('idleAnimations', true),
			reactToClicks: config.get<boolean>('reactToClicks', true),
			animationSpeed: config.get<number>('animationSpeed', 1.0),
			movementSpeed: config.get<number>('movementSpeed', 1.0),
			unfocusedSleepDelay: config.get<number>('unfocusedSleepDelay', 20),
			disabledActions: config.get<string[]>('disabledActions', [])
		};
	}

	public sendConfig() {
		this.view?.webview.postMessage({ command: 'SET_CONFIG', ...this.getConfig() });
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
					this.sendConfig();
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
			sceneProps: this.state.sceneProps.length > 0 ? this.state.sceneProps : undefined,
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

	public setScene(payload: { props: ScenePropCommandEntry[] }) {
		this.state.sceneProps = payload.props.map(p => ({ id: p.propId, type: p.propType, label: p.label, state: 'idle' }));
		this.view?.webview.postMessage({ command: 'SET_SCENE', props: payload.props });
		this.onStateChange?.(this.getState());
	}

	public placeSceneProp(payload: ScenePropCommandEntry & { durationSeconds?: number; finishBehavior?: string }) {
		this.state.sceneProps = this.state.sceneProps.filter(p => p.id !== payload.propId);
		this.state.sceneProps.push({ id: payload.propId, type: payload.propType, label: payload.label, state: 'idle' });
		this.view?.webview.postMessage({ command: 'PLACE_SCENE_PROP', ...payload });
		this.onStateChange?.(this.getState());
	}

	public removeSceneProp(payload: { propId: string }) {
		this.state.sceneProps = this.state.sceneProps.filter(p => p.id !== payload.propId);
		this.view?.webview.postMessage({ command: 'REMOVE_SCENE_PROP', ...payload });
		this.onStateChange?.(this.getState());
	}

	public interactWithProp(payload: { propId: string; durationSeconds?: number; finishBehavior?: string }) {
		const prop = this.state.sceneProps.find(p => p.id === payload.propId);
		if (prop) prop.state = 'targeted';
		this.view?.webview.postMessage({ command: 'INTERACT_WITH_PROP', ...payload });
		this.onStateChange?.(this.getState());
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
				case 'READY': {
					webviewView.webview.postMessage({
						command: 'INIT',
						actions: PET_ACTIONS,
						autopilotEnabled: this.petViewProvider.getState().autopilotEnabled
					});
					break;
				}
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
					webviewView.webview.postMessage({
						command: 'AUTOPILOT_UPDATE',
						enabled: message.enabled
					});
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
				case 'PLACE_SCENE_PROP': {
					if (typeof message?.propType !== 'string') {
						return;
					}
					if (!this.petViewProvider.isReady()) {
						vscode.window.showInformationMessage('Open the Emotional Support view to control the robot.');
						return;
					}
					const propId = `cp-${Date.now()}`;
					this.petViewProvider.placeSceneProp({
						propId,
						propType: message.propType,
						position: typeof message.position === 'string' ? message.position : undefined,
						autoInteract: Boolean(message.autoInteract),
						durationSeconds: message.autoInteract ? 5 : undefined
					});
					break;
				}
				case 'CLEAR_SCENE': {
					if (!this.petViewProvider.isReady()) {
						vscode.window.showInformationMessage('Open the Emotional Support view to control the robot.');
						return;
					}
					this.petViewProvider.setScene({ props: [] });
					break;
				}
				default:
					break;
			}
		});
	}

	private getHtmlForWebview(webview: vscode.Webview) {
		const distPath = vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist');
		const indexPath = vscode.Uri.joinPath(distPath, 'control.html');
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
	<title>Robot Control Panel</title>
	<style>
		body { font-family: sans-serif; padding: 16px; }
		code { background: #f2f2f2; padding: 2px 6px; border-radius: 6px; }
	</style>
</head>
<body>
	<h3>Control panel UI not built yet</h3>
	<p>Run <code>npm run build:webview</code> in the extension workspace.</p>
	<p>${message}</p>
</body>
</html>`;
		}
	}
}
