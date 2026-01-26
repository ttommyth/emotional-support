// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import { PetMcpServer } from './mcp-server';

type PetMood = 'idle' | 'thinking' | 'coding' | 'reading' | 'success' | 'error' | 'sleep';

const MOOD_SEQUENCE: PetMood[] = [
	'idle',
	'thinking',
	'coding',
	'reading',
	'success',
	'error',
	'sleep',
];

export function activate(context: vscode.ExtensionContext) {
	const petViewProvider = new PetViewProvider(context.extensionUri);

	const mcpServer = new PetMcpServer((payload) => {
		petViewProvider.setMood(payload);
	});

	context.subscriptions.push(mcpServer);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(PetViewProvider.viewType, petViewProvider, {
			webviewOptions: { retainContextWhenHidden: true }
		})
	);

	mcpServer.start();

	context.subscriptions.push(
		vscode.commands.registerCommand('emotional-support.setPetMood', async () => {
			if (!petViewProvider.isReady()) {
				vscode.window.showInformationMessage('Open the Emotional Support view first.');
				return;
			}
			const currentMood = petViewProvider.getCurrentMood() ?? 'idle';
			const nextIndex = (MOOD_SEQUENCE.indexOf(currentMood) + 1) % MOOD_SEQUENCE.length;
			const nextMood = MOOD_SEQUENCE[nextIndex];
			petViewProvider.setMood({ mood: nextMood, message: 'Demo mood update.' });
		})
	);
}

export function deactivate() {}

class PetViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'emotional-support.petView';

	private view: vscode.WebviewView | undefined;
	private readonly extensionUri: vscode.Uri;
	private readonly state: { currentMood?: PetMood } = {};

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
					if (typeof message?.mood === 'string') {
						this.setMood({ mood: message.mood as PetMood, message: message.message });
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

	public setMood(payload: { mood: PetMood; message?: string }) {
		this.state.currentMood = payload.mood;
		this.view?.webview.postMessage({ command: 'SET_MOOD', ...payload });
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

