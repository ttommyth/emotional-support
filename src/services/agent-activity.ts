import * as vscode from 'vscode';

/**
 * Normalized "what the AI agent is doing right now" signal.
 *
 * Providers (VS Code heuristics, the Cursor hook bridge, the Copilot native
 * tool, …) emit these; the `AgentReactionController` consumes them. This is
 * deliberately MCP-free — every provider is just a class that feeds the same
 * sink, so adding a new integration is a matter of implementing
 * {@link AgentActivityProvider}.
 */

export type AgentActivityKind =
	| 'thinking'
	| 'reading'
	| 'searching'
	| 'editing'
	| 'testing'
	| 'building'
	| 'debugging'
	| 'error'
	| 'done'
	| 'idle';

export type AgentActivitySeverity = 'info' | 'warning' | 'error';

export type AgentActivity = {
	/** Identifies which agent conversation/run produced this. Multiple sessions may interleave. */
	sessionId: string;
	kind: AgentActivityKind;
	/** Human-readable context: file name, command line, tool name. */
	detail?: string;
	/** Explicit message override (provider-authored). Takes priority over generated text. */
	message?: string;
	severity?: AgentActivitySeverity;
	timestamp: number;
};

export type AgentActivitySink = (activity: AgentActivity) => void;

/**
 * A source of normalized agent-activity events. Implement one per integration
 * (VS Code heuristics, Cursor hook bridge, Copilot native tool, …). Registering
 * a new provider is all that's needed to feed the reaction system.
 */
export interface AgentActivityProvider extends vscode.Disposable {
	/** Stable id, e.g. 'vscode-heuristics' | 'cursor-hooks' | 'copilot-tool' */
	readonly id: string;
	/** Begin emitting normalized AgentActivity into the sink. */
	start(sink: AgentActivitySink): void;
}

export const AGENT_ACTIVITY_KINDS: readonly AgentActivityKind[] = [
	'thinking', 'reading', 'searching', 'editing', 'testing', 'building', 'debugging', 'error', 'done', 'idle'
];

export function isAgentActivityKind(value: string): value is AgentActivityKind {
	return (AGENT_ACTIVITY_KINDS as readonly string[]).includes(value);
}

const SEVERITY_RANK: Record<AgentActivitySeverity, number> = { info: 0, warning: 1, error: 2 };

export function severityRank(severity: AgentActivitySeverity | undefined): number {
	return SEVERITY_RANK[severity ?? 'info'];
}

// ─── Session arbitration ─────────────────────────────────────────────────

export type SessionRecord = {
	sessionId: string;
	lastActivity: number;
	lastKind?: AgentActivityKind;
	prevKind?: AgentActivityKind;
	lastSeverity: AgentActivitySeverity;
	prevSeverity: AgentActivitySeverity;
	/** Timestamp of the last reaction this session actually triggered. */
	lastEmit: number;
};

/**
 * Tracks concurrent agent sessions and decides which one should drive the
 * robot. Policy: a recent error outranks everything; otherwise the most
 * recently active session wins. Stale sessions are pruned so long-lived
 * sessions don't dominate forever.
 */
export class SessionActivityTracker {
	private readonly sessions = new Map<string, SessionRecord>();

	constructor(
		private readonly maxAgeMs = 3 * 60_000,
		private readonly errorPriorityWindowMs = 30_000
	) {}

	record(activity: AgentActivity, now: number = activity.timestamp || Date.now()): SessionRecord {
		let s = this.sessions.get(activity.sessionId);
		if (!s) {
			s = {
				sessionId: activity.sessionId,
				lastActivity: now,
				lastSeverity: 'info',
				prevSeverity: 'info',
				lastEmit: 0
			};
			this.sessions.set(activity.sessionId, s);
		}
		s.prevKind = s.lastKind;
		s.lastKind = activity.kind;
		s.prevSeverity = s.lastSeverity;
		s.lastSeverity = activity.severity ?? 'info';
		s.lastActivity = now;
		this.prune(now);
		return s;
	}

	/** The session that should drive the robot right now (error-first, else most recent). */
	pickDominant(now = Date.now()): string | undefined {
		this.prune(now);
		const errSessions = [...this.sessions.entries()]
			.filter(([, s]) => s.lastSeverity === 'error' && now - s.lastActivity < this.errorPriorityWindowMs)
			.sort((a, b) => b[1].lastActivity - a[1].lastActivity);
		if (errSessions.length > 0) {
			return errSessions[0][0];
		}
		let best: { id: string; last: number } | undefined;
		for (const [id, s] of this.sessions) {
			if (!best || s.lastActivity > best.last) {
				best = { id, last: s.lastActivity };
			}
		}
		return best?.id;
	}

	count(now = Date.now()): number {
		this.prune(now);
		return this.sessions.size;
	}

	prune(now = Date.now()) {
		for (const [id, s] of this.sessions) {
			if (now - s.lastActivity > this.maxAgeMs) {
				this.sessions.delete(id);
			}
		}
	}
}
