import type { RobotActionName } from '../robot/types';

/**
 * Extension ↔ webview message protocol.
 *
 * Extension host sends these to the webview via `webview.postMessage`.
 * The command strings must match what the extension's providers send
 * (see `src/webview/pet-view/PetViewProvider.ts`).
 */
export type ExtensionToWebViewMessage =
	| {
			command: 'SET_CONFIG';
			accentColor: string;
			bodyColor: string;
			visorColor: string;
			limbColor: string;
			defaultEyeColor: string;
			successEyeColor: string;
			errorEyeColor: string;
			idleAnimations: boolean;
			reactToClicks: boolean;
			animationSpeed: number;
			movementSpeed: number;
			defaultTemperature: number;
			unfocusedSleepDelay: number;
			disabledActions: string[];
			showThoughtBubbles: boolean;
			thoughtBubbleDuration: number;
	  }
	| { command: 'SET_MOOD'; mood: RobotActionName; message?: string; durationSeconds?: number; temperature?: number }
	| { command: 'SET_AUTOPILOT'; enabled: boolean }
	| { command: 'SET_TEMPERATURE'; temperature: number }
	| { command: 'FORCE_MOVE'; target: 'front' | 'left' | 'right' }
	| { command: 'SHOW_TOAST'; text: string }
	| {
			command: 'SET_SCENE';
			props: Array<{ propId: string; propType: string; label?: string; position?: string; autoInteract?: boolean }>;
	  }
	| {
			command: 'PLACE_SCENE_PROP';
			propId: string;
			propType: string;
			label?: string;
			position?: string;
			autoInteract?: boolean;
			durationSeconds?: number;
			finishBehavior?: string;
	  }
	| { command: 'REMOVE_SCENE_PROP'; propId: string }
	| { command: 'INTERACT_WITH_PROP'; propId: string; durationSeconds?: number; finishBehavior?: string }
	| { command: 'INTERACT_CLOSEST_PROP' };

/** Messages the webview posts back to the extension host. */
export type WebViewToExtensionMessage = { command: 'READY' } | { command: 'SET_MOOD'; mood: RobotActionName };
