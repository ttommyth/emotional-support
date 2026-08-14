import * as vscode from 'vscode';
import { PET_ACTIONS, PetAction, isPetAction } from '../../domain/actions';
import { WorkspaceVibeService } from '../../services/workspace-vibe-service';
import { MoodHistoryService } from '../../services/mood-history-service';
import { getOutputChannel } from '../../extension';
import { getHtmlForWebview } from '../html';
import { PetViewProvider } from '../pet-view/PetViewProvider';

/**
 * Dev/optional control panel webview view provider.
 */
export class PetControlViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'emotional-support.controlView';

	private view: vscode.WebviewView | undefined;
	private readonly extensionUri: vscode.Uri;
	private readonly petViewProvider: PetViewProvider;
	private readonly vibeService: WorkspaceVibeService;
	private readonly moodHistory: MoodHistoryService;
	private vibeUpdateInterval: NodeJS.Timeout | undefined;

	constructor(
		extensionUri: vscode.Uri,
		petViewProvider: PetViewProvider,
		vibeService: WorkspaceVibeService,
		moodHistory: MoodHistoryService
	) {
		this.extensionUri = extensionUri;
		this.petViewProvider = petViewProvider;
		this.vibeService = vibeService;
		this.moodHistory = moodHistory;
	}

	public resolveWebviewView(webviewView: vscode.WebviewView) {
		this.view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionUri]
		};
		webviewView.webview.html = getHtmlForWebview(this.extensionUri, webviewView.webview, 'control.html', 'Control Panel UI');

		webviewView.webview.onDidReceiveMessage((message) => {
			switch (message?.command) {
				case 'READY': {
					const vibe = this.vibeService.getCurrentVibe();
					const summary = this.moodHistory.getSummary();
					const config = vscode.workspace.getConfiguration('emotional-support');
					webviewView.webview.postMessage({
						command: 'INIT',
						actions: PET_ACTIONS,
						autopilotEnabled: this.petViewProvider.getState().autopilotEnabled,
						vibe,
						sessionSummary: summary,
						personality: config.get<string>('personality', 'supportive'),
						vibeReactions: config.get<boolean>('vibeReactions', true),
						defaultTemperature: config.get<number>('defaultTemperature', 0.5)
					});
					// Start periodic vibe updates
					if (this.vibeUpdateInterval) {
						clearInterval(this.vibeUpdateInterval);
					}
					this.vibeUpdateInterval = setInterval(() => {
						const currentVibe = this.vibeService.getCurrentVibe();
						const currentSummary = this.moodHistory.getSummary();
						webviewView.webview.postMessage({
							command: 'VIBE_UPDATE',
							vibe: currentVibe,
							sessionSummary: currentSummary
						});
					}, 3000);
					break;
				}
				case 'SEND_TOAST': {
					if (typeof message?.text !== 'string' || !this.petViewProvider.isReady()) {
						return;
					}
					this.petViewProvider.setMood({
						mood: (typeof message.mood === 'string' && isPetAction(message.mood)) ? message.mood as PetAction : 'idle',
						durationSeconds: typeof message.durationSeconds === 'number' ? message.durationSeconds : 3
					});
					break;
				}
				case 'SET_PERSONALITY': {
					if (typeof message?.personality === 'string') {
						vscode.workspace.getConfiguration('emotional-support').update('personality', message.personality, vscode.ConfigurationTarget.Global);
					}
					break;
				}
				case 'SET_VIBE_REACTIONS': {
					if (typeof message?.enabled === 'boolean') {
						vscode.workspace.getConfiguration('emotional-support').update('vibeReactions', message.enabled, vscode.ConfigurationTarget.Global);
					}
					break;
				}
				case 'SHOW_SESSION_SUMMARY': {
					this.moodHistory.printSummary();
					getOutputChannel().show(true);
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
						mood: message.action
					});
					break;
				}
				case 'SET_TEMPERATURE': {
					if (typeof message?.temperature !== 'number') {
						return;
					}
					if (!this.petViewProvider.isReady()) {
						vscode.window.showInformationMessage('Open the Emotional Support view to control the robot.');
						return;
					}
					const clamped = Math.max(0, Math.min(1, message.temperature));
					this.petViewProvider.setTemperature(clamped);
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
				case 'INTERACT_CLOSEST_PROP': {
					if (!this.petViewProvider.isReady()) {
						vscode.window.showInformationMessage('Open the Emotional Support view to control the robot.');
						return;
					}
					// send to the pet view, not back to control panel
					this.petViewProvider.interactClosestProp();
					break;
				}
				default:
					break;
			}
		});

		webviewView.onDidDispose(() => {
			if (this.vibeUpdateInterval) {
				clearInterval(this.vibeUpdateInterval);
				this.vibeUpdateInterval = undefined;
			}
		});
	}
}
