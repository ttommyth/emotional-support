import * as vscode from 'vscode';
import type { PetAction } from './domain/actions';
import type { MoodInterpreter } from './services/mood-interpreter';
import type { WorkspaceVibeService } from './services/workspace-vibe-service';
import type { PetViewProvider } from './webview/pet-view/PetViewProvider';

const FOCUS_REACTION_MIN_AWAY_MS = 30_000; // only react after 30s away

// ─── Progressive Wind-Down Phases ─────────────────────────────────────────
// Each phase has a pool of actions, duration range, and delay before
// the next phase fires. The robot gracefully transitions:
//   noticing → settling → resting → drowsy → sleep
const UNFOCUSED_PHASES: {
	actions: PetAction[];
	durationRange: [number, number]; // [min, max] seconds the action plays
	delayMs: number;                 // pause before this phase fires
}[] = [
	// Phase 0 — Noticing: curious, alert reactions
	{ actions: ['lookaround', 'peek', 'stretch', 'shrug'], durationRange: [4, 6], delayMs: 12_000 },
	// Phase 1 — Settling: calmer activities
	{ actions: ['walk', 'sit', 'ballet', 'stretch'], durationRange: [5, 8], delayMs: 18_000 },
	// Phase 2 — Resting: winding down
	{ actions: ['sit', 'rest', 'laydownflat'], durationRange: [8, 14], delayMs: 25_000 },
	// Phase 3 — Drowsy: nearly asleep
	{ actions: ['rest', 'laydownflat'], durationRange: [12, 20], delayMs: 35_000 },
	// Phase 4+ — Sleep (handled as terminal state)
];

/**
 * Watches window focus and drives the robot's progressive wind-down behavior
 * while the user is away, then welcomes them back on return.
 */
export type WindowFocusMonitorOptions = {
	/** Override focus detection (defaults to `vscode.window.state.focused`). */
	isFocused?: () => boolean;
	/** Override the clock (defaults to `Date.now`). */
	now?: () => number;
	/** Minimum away time (ms) before the wind-down / welcome-back reacts. */
	reactionMinAwayMs?: number;
};

export class WindowFocusMonitor implements vscode.Disposable {
	private windowFocusTimer: NodeJS.Timeout | undefined;
	private followUpTimer: NodeJS.Timeout | undefined; // For multi-step behaviors
	private lastFocusLostTime: number | undefined;
	private unfocusedPhase = 0;
	private lastUnfocusedAction: PetAction | undefined;
	private autopilotWasEnabled = true; // Track autopilot state before unfocused override

	private readonly isFocused: () => boolean;
	private readonly now: () => number;
	private readonly reactionMinAwayMs: number;

	constructor(
		private readonly petViewProvider: PetViewProvider,
		private readonly vibeService: WorkspaceVibeService,
		private readonly moodInterpreter: MoodInterpreter,
		private readonly log: (line: string) => void,
		options: WindowFocusMonitorOptions = {}
	) {
		this.isFocused = options.isFocused ?? (() => vscode.window.state.focused);
		this.now = options.now ?? (() => Date.now());
		this.reactionMinAwayMs = options.reactionMinAwayMs ?? FOCUS_REACTION_MIN_AWAY_MS;
	}

	/** Called from the mood service when agent activity is detected. */
	public onAgentActivity() {
		if (!this.isFocused()) {
			this.lastFocusLostTime = this.now();
			if (this.petViewProvider.isReady()) {
				this.startUnfocusedBehaviorCycle('agent-activity');
			}
			this.log(`[WindowMonitor] Agent activity detected while unfocused at ${new Date().toISOString()}`);
		}
	}

	public onWindowStateChange(state: vscode.WindowState) {
		const isFocused = state.focused;

		if (!isFocused) {
			// Window lost focus — start unfocused cycle after a grace period
			if (!this.lastFocusLostTime) {
				this.lastFocusLostTime = this.now();
			}
			// Delay the unfocused behavior cycle so quick alt-tabs don't trigger reactions
			this.clearAllTimers();
			this.windowFocusTimer = setTimeout(() => {
				if (!this.isFocused() && this.lastFocusLostTime) {
					this.startUnfocusedBehaviorCycle('window-blur');
				}
			}, this.reactionMinAwayMs);
			this.log(`[WindowMonitor] Window lost focus at ${new Date().toISOString()}`);
		} else {
			// Window gained focus
			if (this.lastFocusLostTime) {
				const inactiveTimeMs = this.now() - this.lastFocusLostTime;
				const inactiveTimeMin = Math.floor(inactiveTimeMs / 60000);
				this.log(`[WindowMonitor] Window regained focus after ${inactiveTimeMin} minutes inactive`);

				// Restore autopilot state that was disabled during wind-down
				this.petViewProvider.setAutopilot(this.autopilotWasEnabled);

				// Only show welcome-back if away long enough to matter
				if (this.petViewProvider.isReady() && inactiveTimeMs >= this.reactionMinAwayMs) {
					// Use the mood interpreter for a personalized welcome back
					const currentVibe = this.vibeService.getCurrentVibe();
					const welcomeReaction = this.moodInterpreter.welcomeBack(currentVibe);
					this.petViewProvider.setMood({
						mood: welcomeReaction.mood,
						durationSeconds: welcomeReaction.durationSeconds
					});
					if (Math.random() < 0.3) {
						this.petViewProvider.forceMove('front');
					}
				}
				this.lastFocusLostTime = undefined;
			}

			// Clear any pending timers
			this.clearAllTimers();

			this.log(`[WindowMonitor] Window gained focus at ${new Date().toISOString()}`);
		}
	}

	public dispose() {
		this.clearAllTimers();
	}

	private startUnfocusedBehaviorCycle(reason: string) {
		this.unfocusedPhase = 0;
		this.lastUnfocusedAction = undefined;
		this.clearAllTimers();

		// Only capture autopilot state on the FIRST call — subsequent calls
		// (e.g. agent-activity while already unfocused) must not re-capture
		// since autopilot is already disabled at that point.
		const isFirstCall = this.petViewProvider.getState().autopilotEnabled;
		if (isFirstCall) {
			this.autopilotWasEnabled = true;
			this.petViewProvider.setAutopilot(false);
		}

		this.scheduleNextPhase();
		this.log(`[WindowMonitor] Wind-down cycle started (${reason}) at ${new Date().toISOString()}`);
	}

	private scheduleNextPhase() {
		if (this.unfocusedPhase >= UNFOCUSED_PHASES.length) {
			// Terminal state: sleep until focus returns
			this.petViewProvider.setMood({ mood: 'sleep' });
			this.log(`[WindowMonitor] Entered sleep (final phase) at ${new Date().toISOString()}`);
			return;
		}

		const phase = UNFOCUSED_PHASES[this.unfocusedPhase];
		const jitter = 0.15;
		const jitteredDelay = phase.delayMs * (1 + (Math.random() * 2 - 1) * jitter);

		this.windowFocusTimer = setTimeout(() => {
			if (!this.isFocused() && this.petViewProvider.isReady()) {
				if (!this.lastFocusLostTime) {
					return;
				}

				const disabledActions = this.petViewProvider.getConfig().disabledActions;
				const enabledActions = phase.actions.filter(
					(action) => !disabledActions.includes(action)
				);

				if (enabledActions.length === 0) {
					// No actions available in this phase — skip to next
					this.unfocusedPhase += 1;
					this.scheduleNextPhase();
					return;
				}

				// Pick a random action, avoiding repeats
				const candidates = enabledActions.filter(a => a !== this.lastUnfocusedAction);
				const pool = candidates.length > 0 ? candidates : enabledActions;
				const nextAction = pool[Math.floor(Math.random() * pool.length)];
				this.lastUnfocusedAction = nextAction;

				const [minDur, maxDur] = phase.durationRange;
				const durationSeconds = minDur + Math.random() * (maxDur - minDur);

				this.petViewProvider.setMood({
					mood: nextAction,
					durationSeconds
				});

				this.log(`[WindowMonitor] Phase ${this.unfocusedPhase}: ${nextAction} for ${durationSeconds.toFixed(1)}s`);
				this.unfocusedPhase += 1;
				this.scheduleNextPhase();
			}
		}, jitteredDelay);
	}

	private clearAllTimers() {
		if (this.windowFocusTimer) {
			clearTimeout(this.windowFocusTimer);
			this.windowFocusTimer = undefined;
		}
		if (this.followUpTimer) {
			clearTimeout(this.followUpTimer);
			this.followUpTimer = undefined;
		}
	}
}
