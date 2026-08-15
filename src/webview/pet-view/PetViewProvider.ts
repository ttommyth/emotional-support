import * as vscode from 'vscode';
import { isPetAction, PetAction } from '../../domain/actions';
import type { RobotControlState, ScenePropCommandEntry } from '../../bridge/mcp-protocol';
import { getHtmlForWebview } from '../html';

/**
 * Webview view provider for the main robot view. Implements the
 * {@link RobotControlTarget} protocol consumed by the McpBridge.
 */
export class PetViewProvider implements vscode.WebviewViewProvider {
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
			defaultTemperature: config.get<number>('defaultTemperature', 0.5),
			unfocusedSleepDelay: config.get<number>('unfocusedSleepDelay', 20),
			disabledActions: config.get<string[]>('disabledActions', []),
			showThoughtBubbles: config.get<boolean>('showThoughtBubbles', true),
			thoughtBubbleDuration: config.get<number>('thoughtBubbleDuration', 8)
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
		webviewView.webview.html = getHtmlForWebview(this.extensionUri, webviewView.webview, 'index.html', 'Webview UI');

		webviewView.webview.onDidReceiveMessage((message) => {
			switch (message?.command) {
				case 'READY': {
					this.sendConfig();
					this.setMood({ mood: 'idle' });
					this.setAutopilot(this.state.autopilotEnabled);
					break;
				}
				case 'SET_MOOD': {
					if (typeof message?.mood === 'string' && isPetAction(message.mood)) {
						this.setMood({ mood: message.mood });
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

	public setMood(payload: { mood: PetAction; message?: string; durationSeconds?: number; temperature?: number; bubble?: 'thought' | 'label' }) {
		this.state.currentMood = payload.mood;
		this.view?.webview.postMessage({ command: 'SET_MOOD', ...payload });
		this.onStateChange?.(this.getState());
	}

	public setTemperature(temperature: number) {
		this.view?.webview.postMessage({ command: 'SET_TEMPERATURE', temperature });
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
		if (prop) {prop.state = 'targeted';}
		this.view?.webview.postMessage({ command: 'INTERACT_WITH_PROP', ...payload });
		this.onStateChange?.(this.getState());
	}

	/** Tell the pet view to pick up the closest scene prop using its internal
	 * lookup logic. This mirrors the new webview message type received by App.tsx.
	 */
	public interactClosestProp() {
		if (!this.view) {
			return;
		}
		this.view.webview.postMessage({ command: 'INTERACT_CLOSEST_PROP' });
	}
}
