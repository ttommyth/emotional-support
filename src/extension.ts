// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import { PetAction, PetMcpServer } from './mcp-server';

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
const SPECIAL_ACTIONS: PetAction[] = ['knocked'];
const PET_ACTIONS: PetAction[] = [...IDLE_ACTIONS, ...CODING_ACTIONS, ...SPECIAL_ACTIONS];

const isPetAction = (value: string): value is PetAction => PET_ACTIONS.includes(value as PetAction);

export function activate(context: vscode.ExtensionContext) {
	const petViewProvider = new PetViewProvider(context.extensionUri);
	const isDevMode = context.extensionMode === vscode.ExtensionMode.Development;
	vscode.commands.executeCommand('setContext', 'emotional-support.isDev', isDevMode);

	const mcpServer = new PetMcpServer((payload) => {
		petViewProvider.setMood(payload);
	});

	context.subscriptions.push(mcpServer);
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

	mcpServer.start();

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
}

export function deactivate() {}

class PetViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'emotional-support.petView';

	private view: vscode.WebviewView | undefined;
	private readonly extensionUri: vscode.Uri;
	private readonly state: { currentMood?: PetAction } = {};

	constructor(extensionUri: vscode.Uri) {
		this.extensionUri = extensionUri;
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

	public setMood(payload: { mood: PetAction; message?: string }) {
		this.state.currentMood = payload.mood;
		this.view?.webview.postMessage({ command: 'SET_MOOD', ...payload });
	}

	public setAutopilot(enabled: boolean) {
		this.view?.webview.postMessage({ command: 'SET_AUTOPILOT', enabled });
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

