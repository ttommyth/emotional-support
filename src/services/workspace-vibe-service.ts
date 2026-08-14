import * as vscode from 'vscode';
import { getOutputChannel } from '../extension';

// ─── Types ────────────────────────────────────────────────────────────────

export type GitState = 'clean' | 'dirty' | 'conflicted' | 'unknown';

export type WorkspaceVibe = {
	/** 0–100 stress score derived from errors, save frequency, context switching, etc. */
	stressScore: number;
	errorCount: number;
	warningCount: number;
	/** Time since last save in seconds */
	timeSinceLastSaveMs: number;
	/** Number of editor switches in the last 60 seconds */
	contextSwitchRate: number;
	/** Rough typing speed indicator: chars changed per second over recent window */
	typingIntensity: number;
	/** Whether the user has been deleting a lot more than typing (frustration signal) */
	deletionSpike: boolean;
	gitState: GitState;
	/** Human-readable summary of what's happening */
	summary: string;
	/** Timestamp */
	timestamp: number;
};

export type VibeLevel = 'zen' | 'focused' | 'busy' | 'stressed' | 'overwhelmed';

export function vibeLevel(score: number): VibeLevel {
	if (score < 15) {return 'zen';}
	if (score < 35) {return 'focused';}
	if (score < 55) {return 'busy';}
	if (score < 75) {return 'stressed';}
	return 'overwhelmed';
}

// ─── Service ──────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 15_000; // minimum time between vibe emissions (15s — robot should mostly idle)
const CONTEXT_SWITCH_WINDOW_MS = 60_000; // 1 minute window for switch tracking

export class WorkspaceVibeService implements vscode.Disposable {
	private readonly disposables: vscode.Disposable[] = [];
	private emitTimer: NodeJS.Timeout | undefined;
	private lastEmitTime = 0;

	// ── Tracked signals ──
	private errorCount = 0;
	private warningCount = 0;
	private lastSaveTime = Date.now();
	private editorSwitchTimestamps: number[] = [];
	private recentInsertions = 0;
	private recentDeletions = 0;
	private typingWindowStart = Date.now();
	private gitState: GitState = 'unknown';

	// ── Callbacks ──
	private readonly onVibeChange: (vibe: WorkspaceVibe) => void;

	// ── Config ──
	private highErrorThreshold = 10;

	constructor(onVibeChange: (vibe: WorkspaceVibe) => void) {
		this.onVibeChange = onVibeChange;
	}

	public start() {
		// —— Diagnostic changes ——
		this.disposables.push(
			vscode.languages.onDidChangeDiagnostics((e) => {
				this.recalcDiagnostics();
				this.scheduleEmit('diagnostics');
			})
		);

		// —— Text document changes (typing patterns) ——
		this.disposables.push(
			vscode.workspace.onDidChangeTextDocument((e) => {
				if (e.document.uri.scheme !== 'file') {return;}
				// Ignore node_modules
				if (e.document.uri.fsPath.includes('node_modules')) {return;}

				for (const change of e.contentChanges) {
					this.recentInsertions += change.text.length;
					this.recentDeletions += change.rangeLength;
				}
			})
		);

		// —— Save events ——
		this.disposables.push(
			vscode.workspace.onDidSaveTextDocument(() => {
				this.lastSaveTime = Date.now();
				this.scheduleEmit('save');
			})
		);

		// —— Editor switches ——
		this.disposables.push(
			vscode.window.onDidChangeActiveTextEditor(() => {
				this.editorSwitchTimestamps.push(Date.now());
				this.scheduleEmit('editor-switch');
			})
		);

		// —— Periodic git check ——
		const gitCheckInterval = setInterval(() => {
			this.checkGitState();
		}, 30_000); // every 30s
		this.disposables.push({ dispose: () => clearInterval(gitCheckInterval) });

		// —— Periodic typing stats reset ——
		const typingResetInterval = setInterval(() => {
			this.resetTypingWindow();
		}, 15_000); // reset every 15s
		this.disposables.push({ dispose: () => clearInterval(typingResetInterval) });

		// Initial diagnostics scan
		this.recalcDiagnostics();
		this.checkGitState();

		getOutputChannel().appendLine('[WorkspaceVibeService] Started monitoring workspace signals.');
	}

	public updateConfig(config: { highErrorThreshold?: number }) {
		if (config.highErrorThreshold !== undefined) {
			this.highErrorThreshold = config.highErrorThreshold;
		}
	}

	public getCurrentVibe(): WorkspaceVibe {
		return this.computeVibe();
	}

	public dispose() {
		for (const d of this.disposables) {d.dispose();}
		this.disposables.length = 0;
		if (this.emitTimer) {
			clearTimeout(this.emitTimer);
			this.emitTimer = undefined;
		}
	}

	// ─── Internals ────────────────────────────────────────────────────

	private recalcDiagnostics() {
		let errors = 0;
		let warnings = 0;
		for (const [uri, diags] of vscode.languages.getDiagnostics()) {
			// Skip non-file URIs and node_modules
			if (uri.scheme !== 'file') {continue;}
			if (uri.fsPath.includes('node_modules')) {continue;}
			for (const d of diags) {
				if (d.severity === vscode.DiagnosticSeverity.Error) {errors++;}
				else if (d.severity === vscode.DiagnosticSeverity.Warning) {warnings++;}
			}
		}
		this.errorCount = errors;
		this.warningCount = warnings;
	}

	private async checkGitState() {
		try {
			const gitExt = vscode.extensions.getExtension('vscode.git');
			if (!gitExt) {
				this.gitState = 'unknown';
				return;
			}
			const git = gitExt.isActive ? gitExt.exports : await gitExt.activate();
			const api = git?.getAPI?.(1);
			if (!api || api.repositories.length === 0) {
				this.gitState = 'unknown';
				return;
			}
			const repo = api.repositories[0];
			const mergeChanges = repo.state?.mergeChanges ?? [];
			const workingChanges = repo.state?.workingTreeChanges ?? [];
			const indexChanges = repo.state?.indexChanges ?? [];

			if (mergeChanges.length > 0) {
				this.gitState = 'conflicted';
			} else if (workingChanges.length > 0 || indexChanges.length > 0) {
				this.gitState = 'dirty';
			} else {
				this.gitState = 'clean';
			}
		} catch {
			this.gitState = 'unknown';
		}
	}

	private resetTypingWindow() {
		const elapsed = (Date.now() - this.typingWindowStart) / 1000;
		if (elapsed > 0) {
			// Store rate before resetting
			this.recentInsertions = 0;
			this.recentDeletions = 0;
			this.typingWindowStart = Date.now();
		}
	}

	private getContextSwitchRate(): number {
		const now = Date.now();
		this.editorSwitchTimestamps = this.editorSwitchTimestamps.filter(
			(t) => now - t < CONTEXT_SWITCH_WINDOW_MS
		);
		return this.editorSwitchTimestamps.length;
	}

	private computeVibe(): WorkspaceVibe {
		const now = Date.now();
		const timeSinceLastSaveMs = now - this.lastSaveTime;
		const contextSwitchRate = this.getContextSwitchRate();

		const typingElapsed = Math.max((now - this.typingWindowStart) / 1000, 1);
		const typingIntensity = (this.recentInsertions + this.recentDeletions) / typingElapsed;
		const deletionRatio = this.recentInsertions + this.recentDeletions > 20
			? this.recentDeletions / (this.recentInsertions + this.recentDeletions)
			: 0;
		const deletionSpike = deletionRatio > 0.7;

		// ── Stress score calculation ──
		let stress = 0;

		// Errors: 0-40 points
		if (this.errorCount > 0) {
			stress += Math.min(40, (this.errorCount / this.highErrorThreshold) * 40);
		}

		// Warnings: 0-10 points
		stress += Math.min(10, this.warningCount * 0.5);

		// Time since save: 0-15 points (stress rises after 5 minutes)
		const minsSinceSave = timeSinceLastSaveMs / 60_000;
		if (minsSinceSave > 5) {
			stress += Math.min(15, (minsSinceSave - 5) * 2);
		}

		// Context switching: 0-15 points (stress if switching a lot)
		if (contextSwitchRate > 5) {
			stress += Math.min(15, (contextSwitchRate - 5) * 2);
		}

		// Deletion spike: +10
		if (deletionSpike) {
			stress += 10;
		}

		// Git conflicts: +15
		if (this.gitState === 'conflicted') {
			stress += 15;
		}

		stress = Math.min(100, Math.max(0, Math.round(stress)));

		const summary = this.buildSummary(stress, contextSwitchRate, minsSinceSave);

		return {
			stressScore: stress,
			errorCount: this.errorCount,
			warningCount: this.warningCount,
			timeSinceLastSaveMs,
			contextSwitchRate,
			typingIntensity,
			deletionSpike,
			gitState: this.gitState,
			summary,
			timestamp: now
		};
	}

	private buildSummary(stress: number, switchRate: number, minsSinceSave: number): string {
		const parts: string[] = [];
		if (this.errorCount > 0) {parts.push(`${this.errorCount} error${this.errorCount > 1 ? 's' : ''}`);}
		if (this.warningCount > 0) {parts.push(`${this.warningCount} warning${this.warningCount > 1 ? 's' : ''}`);}
		if (minsSinceSave > 10) {parts.push(`unsaved for ${Math.floor(minsSinceSave)}m`);}
		if (switchRate > 8) {parts.push(`rapid file switching`);}
		if (this.gitState === 'conflicted') {parts.push('merge conflicts');}
		if (parts.length === 0) {return 'All clear – smooth sailing.';}
		return parts.join(', ');
	}

	private scheduleEmit(reason: string) {
		if (this.emitTimer) {return;} // already scheduled
		const now = Date.now();
		const timeSinceLast = now - this.lastEmitTime;
		const delay = Math.max(0, DEBOUNCE_MS - timeSinceLast);

		this.emitTimer = setTimeout(() => {
			this.emitTimer = undefined;
			this.lastEmitTime = Date.now();
			const vibe = this.computeVibe();
			getOutputChannel().appendLine(
				`[Vibe] stress=${vibe.stressScore} errors=${vibe.errorCount} warns=${vibe.warningCount} git=${vibe.gitState} (${reason})`
			);
			this.onVibeChange(vibe);
		}, delay);
	}
}
