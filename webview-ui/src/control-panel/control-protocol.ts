/**
 * Message types for the dev control panel webview.
 *
 * The extension's control provider posts INIT / VIBE_UPDATE / AUTOPILOT_UPDATE
 * messages to the panel. These types describe those payloads plus the shared
 * `VibeData` / `SessionSummary` shapes. Extracted from ControlPanel.tsx so the
 * panel component stays focused on rendering.
 */

export type VibeData = {
	stressScore: number;
	errorCount: number;
	warningCount: number;
	timeSinceLastSaveMs: number;
	contextSwitchRate: number;
	typingIntensity: number;
	deletionSpike: boolean;
	gitState: string;
	summary: string;
};

export type SessionSummary = {
	sessionDurationMinutes: number;
	averageStress: number;
	peakStress: number;
	timeInLevels: Record<string, number>;
	peakErrors: number;
	vibeJourney: string;
};

export type InitMessage = {
	command: 'INIT';
	actions: string[];
	autopilotEnabled: boolean;
	vibe?: VibeData;
	sessionSummary?: SessionSummary;
	personality?: string;
	vibeReactions?: boolean;
	defaultTemperature?: number;
};

export type VibeUpdateMessage = {
	command: 'VIBE_UPDATE';
	vibe: VibeData;
	sessionSummary: SessionSummary;
};

export type AutopilotUpdateMessage = {
	command: 'AUTOPILOT_UPDATE';
	enabled: boolean;
};

export type ViewMessage = InitMessage | VibeUpdateMessage | AutopilotUpdateMessage;
