import type { ExtensionToWebViewMessage } from './protocol';

/** Narrowed message shapes for each handled command. */
export type SetConfigMessage = Extract<ExtensionToWebViewMessage, { command: 'SET_CONFIG' }>;
export type SetMoodMessage = Extract<ExtensionToWebViewMessage, { command: 'SET_MOOD' }>;
export type SetSceneMessage = Extract<ExtensionToWebViewMessage, { command: 'SET_SCENE' }>;
export type PlaceScenePropMessage = Extract<ExtensionToWebViewMessage, { command: 'PLACE_SCENE_PROP' }>;
export type InteractWithPropMessage = Extract<ExtensionToWebViewMessage, { command: 'INTERACT_WITH_PROP' }>;

/**
 * Callbacks the robot scene owns. Each method keeps its own defensive field
 * validation, so `handleMessage` only needs to route on the command name.
 */
export interface RobotSceneController {
	showToast(message: { text: string }): void;
	applyConfig(message: SetConfigMessage): void;
	setMood(message: SetMoodMessage): void;
	setAutopilot(message: { enabled: boolean }): void;
	setTemperature(message: { temperature: number }): void;
	forceMove(message: { target: 'front' | 'left' | 'right' }): void;
	setScene(message: SetSceneMessage): void;
	placeSceneProp(message: PlaceScenePropMessage): void;
	removeSceneProp(message: { propId: string }): void;
	interactWithProp(message: InteractWithPropMessage): void;
	interactClosestProp(): void;
}

/**
 * Route an incoming webview message to the matching controller method.
 *
 * The webview receives messages from the extension host via `postMessage`
 * (untyped at runtime), so `event.data` is cast to the protocol union here.
 * Per-field validation stays inside each controller method, preserving the
 * original defensive behavior exactly.
 */
export function handleMessage(controller: RobotSceneController, event: MessageEvent): void {
	const message = event.data as ExtensionToWebViewMessage | undefined;
	switch (message?.command) {
		case 'SET_CONFIG':
			controller.applyConfig(message as SetConfigMessage);
			break;
		case 'SHOW_TOAST':
			controller.showToast(message as { text: string });
			break;
		case 'SET_MOOD':
			controller.setMood(message as SetMoodMessage);
			break;
		case 'SET_AUTOPILOT':
			controller.setAutopilot(message as { enabled: boolean });
			break;
		case 'SET_TEMPERATURE':
			controller.setTemperature(message as { temperature: number });
			break;
		case 'FORCE_MOVE':
			controller.forceMove(message as { target: 'front' | 'left' | 'right' });
			break;
		case 'SET_SCENE':
			controller.setScene(message as SetSceneMessage);
			break;
		case 'PLACE_SCENE_PROP':
			controller.placeSceneProp(message as PlaceScenePropMessage);
			break;
		case 'REMOVE_SCENE_PROP':
			controller.removeSceneProp(message as { propId: string });
			break;
		case 'INTERACT_WITH_PROP':
			controller.interactWithProp(message as InteractWithPropMessage);
			break;
		case 'INTERACT_CLOSEST_PROP':
			controller.interactClosestProp();
			break;
	}
}
