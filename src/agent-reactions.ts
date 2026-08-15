import * as vscode from 'vscode';
import type { PetAction } from './domain/actions';
import type { AgentActivity, AgentActivityKind, AgentActivitySeverity } from './services/agent-activity';
import { severityRank, SessionActivityTracker } from './services/agent-activity';
import type { PetViewProvider } from './webview/pet-view/PetViewProvider';

/**
 * Turns a normalized AgentActivity into a concrete robot reaction.
 *
 * The deterministic {@link HeuristicAgentReactionDecider} is the default. An
 * LLM-backed decider (e.g. via Cactus Needle 2 as a local Python engine, or
 * `vscode.lm` with a BYO-key model) can implement this same interface later and
 * be swapped in without touching the controller or the providers — that's the
 * planned home for richer, personality-tuned "liveliness".
 */
export interface AgentReactionDecider {
	decide(activity: AgentActivity, context: { sessionCount: number }): AgentReaction | null;
}

export type AgentReaction = {
	action: PetAction;
	message?: string;
	durationSeconds?: number;
	temperature?: number;
	/** 'thought' = speech bubble (default), 'label' = minimal filename callout with a pointer line. */
	bubble?: 'thought' | 'label';
	sceneAction?: { type: 'place'; propType: string; autoInteract: boolean };
};

// ─── Deterministic decider ────────────────────────────────────────────────

const KIND_ACTION: Record<AgentActivityKind, { action: PetAction; temperature: number }> = {
	thinking: { action: 'thinking', temperature: 0.4 },
	reading: { action: 'reading', temperature: 0.4 },
	searching: { action: 'inspect', temperature: 0.5 },
	editing: { action: 'coding', temperature: 0.6 },
	testing: { action: 'testing', temperature: 0.6 },
	building: { action: 'refactoring', temperature: 0.7 },
	debugging: { action: 'debugging', temperature: 0.8 },
	error: { action: 'error', temperature: 0.9 },
	done: { action: 'success', temperature: 0.5 },
	idle: { action: 'idle', temperature: 0.3 }
};

const DONE_PROP_CHANCE = 0.2;
const ERROR_PROP_CHANCE = 0.15;

export class HeuristicAgentReactionDecider implements AgentReactionDecider {
	decide(activity: AgentActivity): AgentReaction | null {
		const base = KIND_ACTION[activity.kind];
		const reaction: AgentReaction = {
			action: base.action,
			temperature: base.temperature,
			durationSeconds: activity.kind === 'error' ? 6 : activity.kind === 'done' ? 5 : 4
		};
		// Agent reactions are silent (no speech bubble). Reading/editing show a
		// minimal filename callout instead.
		if ((activity.kind === 'reading' || activity.kind === 'editing') && activity.detail) {
			reaction.bubble = 'label';
			reaction.message = activity.detail;
		}
		if (activity.kind === 'done' && Math.random() < DONE_PROP_CHANCE) {
			reaction.sceneAction = { type: 'place', propType: 'trophy', autoInteract: false };
		} else if (activity.kind === 'error' && Math.random() < ERROR_PROP_CHANCE) {
			reaction.sceneAction = { type: 'place', propType: 'wrench', autoInteract: false };
		}
		return reaction;
	}
}

// ─── Controller ───────────────────────────────────────────────────────────

export type AgentReactionControllerOptions = {
	enabled?: boolean;
	minIntervalMs?: number;
};

/**
 * Consumes normalized AgentActivity from all providers, arbitrates between
 * concurrent agent sessions, and drives the robot via `PetViewProvider`.
 *
 * Priority: only the currently-dominant session may trigger a reaction; a
 * recent error escalates and takes over. Per-session rate limiting plus
 * immediate reaction on kind change keeps it lively without spamming.
 */
export class AgentReactionController implements vscode.Disposable {
	private enabled: boolean;
	private readonly minIntervalMs: number;
	private readonly tracker = new SessionActivityTracker();
	private readonly decider: AgentReactionDecider;
	private readonly petViewProvider: PetViewProvider;

	constructor(
		petViewProvider: PetViewProvider,
		decider: AgentReactionDecider,
		options: AgentReactionControllerOptions = {}
	) {
		this.petViewProvider = petViewProvider;
		this.decider = decider;
		this.enabled = options.enabled ?? true;
		this.minIntervalMs = options.minIntervalMs ?? 6000;
	}

	setEnabled(enabled: boolean) {
		this.enabled = enabled;
	}

	handleActivity(activity: AgentActivity) {
		if (!this.enabled) {
			return;
		}
		if (!this.petViewProvider.isReady()) {
			return;
		}
		// Unfocused wind-down owns the robot while the window is away.
		if (!vscode.window.state.focused) {
			return;
		}

		const now = activity.timestamp || Date.now();
		const session = this.tracker.record(activity, now);
		const dominant = this.tracker.pickDominant(now);
		if (!dominant || dominant !== activity.sessionId) {
			return;
		}

		const kindChanged = session.prevKind !== undefined && session.prevKind !== activity.kind;
		const escalated = severityRank(activity.severity) > severityRank(session.prevSeverity);
		if (!kindChanged && !escalated && now - session.lastEmit < this.minIntervalMs) {
			return;
		}
		session.lastEmit = now;

		const reaction = this.decider.decide(activity, { sessionCount: this.tracker.count(now) });
		if (!reaction) {
			return;
		}

		this.petViewProvider.setMood({
			mood: reaction.action,
			message: reaction.message,
			durationSeconds: reaction.durationSeconds,
			temperature: reaction.temperature,
			bubble: reaction.bubble
		});
		if (reaction.sceneAction?.type === 'place') {
			this.petViewProvider.placeSceneProp({
				propId: `agent-${now}`,
				propType: reaction.sceneAction.propType,
				autoInteract: reaction.sceneAction.autoInteract
			});
		}
	}

	dispose() {
		// No owned timers or subscriptions; sessions are in-memory only.
	}
}
