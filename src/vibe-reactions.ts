import * as vscode from 'vscode';
import type { WorkspaceVibe } from './services/workspace-vibe-service';
import type { MoodInterpreter, Personality } from './services/mood-interpreter';
import type { MoodHistoryService } from './services/mood-history-service';
import type { PetViewProvider } from './webview/pet-view/PetViewProvider';

/**
 * Orchestrates the robot's reactions to workspace "vibe" changes:
 * milestone celebrations (errors cleared, stress relieved) and normal
 * mood interpretation. Also owns the vibe-reaction config state.
 */
export class VibeReactionController {
	private vibeReactionsEnabled = true;

	constructor(
		private readonly moodHistory: MoodHistoryService,
		private readonly moodInterpreter: MoodInterpreter,
		private readonly petViewProvider: PetViewProvider
	) {}

	public handleVibeChange(vibe: WorkspaceVibe) {
		this.moodHistory.record(vibe);

		if (!this.vibeReactionsEnabled || !this.petViewProvider.isReady() || !vscode.window.state.focused) {
			return;
		}

		// Check for milestone moments first
		if (this.moodHistory.justClearedErrors()) {
			const reaction = this.moodInterpreter.celebrate('All errors cleared!');
			this.petViewProvider.setMood({ mood: reaction.mood, durationSeconds: reaction.durationSeconds, temperature: reaction.temperature });
			if (reaction.sceneAction?.type === 'place') {
				this.petViewProvider.placeSceneProp({
					propId: `vibe-${Date.now()}`,
					propType: reaction.sceneAction.propType,
					autoInteract: reaction.sceneAction.autoInteract
				});
			}
			return;
		}

		if (this.moodHistory.justRelieved()) {
			const reaction = this.moodInterpreter.celebrate('Stress level dropped — you crushed it!');
			this.petViewProvider.setMood({ mood: reaction.mood, durationSeconds: reaction.durationSeconds, temperature: reaction.temperature });
			return;
		}

		// Normal vibe interpretation — only change pose, stay quiet
		// (milestones/celebrations above already have messages)
		const reaction = this.moodInterpreter.interpret(vibe);
		if (!reaction) {
			return;
		}

		this.petViewProvider.setMood({
			mood: reaction.mood,
			durationSeconds: reaction.durationSeconds,
			temperature: reaction.temperature
		});

		if (reaction.sceneAction?.type === 'place') {
			this.petViewProvider.placeSceneProp({
				propId: `vibe-${Date.now()}`,
				propType: reaction.sceneAction.propType,
				autoInteract: reaction.sceneAction.autoInteract
			});
		} else if (reaction.sceneAction?.type === 'clear') {
			this.petViewProvider.setScene({ props: [] });
		}
	}

	/** Re-read config; returns the vibe-service threshold settings to apply. */
	public updateConfig(): { highErrorThreshold: number } {
		const config = vscode.workspace.getConfiguration('emotional-support');
		this.vibeReactionsEnabled = config.get<boolean>('vibeReactions', true);
		const personality = config.get<string>('personality', 'supportive');
		if (personality === 'supportive' || personality === 'sarcastic' || personality === 'stoic') {
			this.moodInterpreter.setPersonality(personality as Personality);
		}
		return {
			highErrorThreshold: config.get<number>('highErrorThreshold', 10)
		};
	}
}
