import type { WorkspaceVibe, VibeLevel } from './workspace-vibe-service';
import { vibeLevel } from './workspace-vibe-service';
import { getOutputChannel } from './extension';

// ─── Types ────────────────────────────────────────────────────────────────

export type MoodHistoryEntry = {
	timestamp: number;
	stressScore: number;
	level: VibeLevel;
	errorCount: number;
};

export type SessionSummary = {
	sessionStartTime: number;
	sessionDurationMinutes: number;
	averageStress: number;
	peakStress: number;
	timeInLevels: Record<VibeLevel, number>; // percentage 0-100
	totalErrorsSeen: number;
	peakErrors: number;
	vibeJourney: string; // human-readable emoji timeline
};

// ─── Service ──────────────────────────────────────────────────────────────

const MAX_HISTORY = 500; // Keep last ~25 minutes at 3s intervals

export class MoodHistoryService {
	private readonly history: MoodHistoryEntry[] = [];
	private readonly sessionStart = Date.now();
	private totalErrorsSeen = 0;
	private peakErrors = 0;
	private peakStress = 0;

	/** Record a new vibe snapshot */
	public record(vibe: WorkspaceVibe) {
		const entry: MoodHistoryEntry = {
			timestamp: vibe.timestamp,
			stressScore: vibe.stressScore,
			level: vibeLevel(vibe.stressScore),
			errorCount: vibe.errorCount
		};
		this.history.push(entry);
		if (this.history.length > MAX_HISTORY) {
			this.history.shift();
		}
		this.totalErrorsSeen = Math.max(this.totalErrorsSeen, vibe.errorCount);
		this.peakErrors = Math.max(this.peakErrors, vibe.errorCount);
		this.peakStress = Math.max(this.peakStress, vibe.stressScore);
	}

	/** Check if the user just cleared all errors (celebration trigger!) */
	public justClearedErrors(): boolean {
		if (this.history.length < 2) {return false;}
		const prev = this.history[this.history.length - 2];
		const curr = this.history[this.history.length - 1];
		return prev.errorCount >= 3 && curr.errorCount === 0;
	}

	/** Check if stress just dropped significantly (relief moment) */
	public justRelieved(): boolean {
		if (this.history.length < 3) {return false;}
		const recent = this.history.slice(-3);
		const avgPrev = (recent[0].stressScore + recent[1].stressScore) / 2;
		const curr = recent[2].stressScore;
		return avgPrev >= 50 && curr < 25;
	}

	/** Check if stress has been climbing (early warning) */
	public stressClimbing(): boolean {
		if (this.history.length < 4) {return false;}
		const recent = this.history.slice(-4);
		return recent.every((e, i) => i === 0 || e.stressScore > recent[i - 1].stressScore)
			&& recent[recent.length - 1].stressScore > 40;
	}

	/** Generate a session summary */
	public getSummary(): SessionSummary {
		const elapsed = (Date.now() - this.sessionStart) / 60_000;
		if (this.history.length === 0) {
			return {
				sessionStartTime: this.sessionStart,
				sessionDurationMinutes: elapsed,
				averageStress: 0,
				peakStress: 0,
				timeInLevels: { zen: 100, focused: 0, busy: 0, stressed: 0, overwhelmed: 0 },
				totalErrorsSeen: 0,
				peakErrors: 0,
				vibeJourney: '🟢'
			};
		}

		const avgStress = this.history.reduce((s, e) => s + e.stressScore, 0) / this.history.length;

		// Calculate time in each level
		const levels: VibeLevel[] = ['zen', 'focused', 'busy', 'stressed', 'overwhelmed'];
		const levelCounts: Record<VibeLevel, number> = { zen: 0, focused: 0, busy: 0, stressed: 0, overwhelmed: 0 };
		for (const entry of this.history) {
			levelCounts[entry.level]++;
		}
		const timeInLevels = {} as Record<VibeLevel, number>;
		for (const l of levels) {
			timeInLevels[l] = Math.round((levelCounts[l] / this.history.length) * 100);
		}

		// Build emoji timeline (sample ~20 points)
		const sampleSize = Math.min(20, this.history.length);
		const step = Math.max(1, Math.floor(this.history.length / sampleSize));
		const emojis: string[] = [];
		for (let i = 0; i < this.history.length; i += step) {
			emojis.push(levelEmoji(this.history[i].level));
		}

		return {
			sessionStartTime: this.sessionStart,
			sessionDurationMinutes: Math.round(elapsed * 10) / 10,
			averageStress: Math.round(avgStress),
			peakStress: this.peakStress,
			timeInLevels,
			totalErrorsSeen: this.totalErrorsSeen,
			peakErrors: this.peakErrors,
			vibeJourney: emojis.join('')
		};
	}

	/** Print a formatted summary to the output channel */
	public printSummary() {
		const s = this.getSummary();
		const ch = getOutputChannel();
		ch.appendLine('');
		ch.appendLine('╔══════════════════════════════════════════════╗');
		ch.appendLine('║   🤖 Emotional Support — Session Summary    ║');
		ch.appendLine('╠══════════════════════════════════════════════╣');
		ch.appendLine(`║  Duration:        ${s.sessionDurationMinutes} minutes`);
		ch.appendLine(`║  Average Stress:  ${s.averageStress}/100 ${stressBar(s.averageStress)}`);
		ch.appendLine(`║  Peak Stress:     ${s.peakStress}/100`);
		ch.appendLine(`║  Peak Errors:     ${s.peakErrors}`);
		ch.appendLine('║');
		ch.appendLine('║  Time Distribution:');
		ch.appendLine(`║    🟢 Zen:          ${s.timeInLevels.zen}%`);
		ch.appendLine(`║    🔵 Focused:      ${s.timeInLevels.focused}%`);
		ch.appendLine(`║    🟡 Busy:         ${s.timeInLevels.busy}%`);
		ch.appendLine(`║    🟠 Stressed:     ${s.timeInLevels.stressed}%`);
		ch.appendLine(`║    🔴 Overwhelmed:  ${s.timeInLevels.overwhelmed}%`);
		ch.appendLine('║');
		ch.appendLine(`║  Vibe Journey: ${s.vibeJourney}`);
		ch.appendLine('╚══════════════════════════════════════════════╝');
		ch.appendLine('');
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function levelEmoji(level: VibeLevel): string {
	switch (level) {
		case 'zen': return '🟢';
		case 'focused': return '🔵';
		case 'busy': return '🟡';
		case 'stressed': return '🟠';
		case 'overwhelmed': return '🔴';
	}
}

function stressBar(stress: number): string {
	const filled = Math.round(stress / 10);
	const empty = 10 - filled;
	return '█'.repeat(filled) + '░'.repeat(empty);
}
