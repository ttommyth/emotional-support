import { useEffect, useMemo, useState } from 'react';

declare const acquireVsCodeApi: (() => { postMessage: (message: unknown) => void }) | undefined;

// ─── Types ────────────────────────────────────────────────────────────────

type VibeData = {
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

type SessionSummary = {
	sessionDurationMinutes: number;
	averageStress: number;
	peakStress: number;
	timeInLevels: Record<string, number>;
	peakErrors: number;
	vibeJourney: string;
};

type InitMessage = {
	command: 'INIT';
	actions: string[];
	autopilotEnabled: boolean;
	vibe?: VibeData;
	sessionSummary?: SessionSummary;
	personality?: string;
	vibeReactions?: boolean;
	defaultTemperature?: number;
};

type VibeUpdateMessage = {
	command: 'VIBE_UPDATE';
	vibe: VibeData;
	sessionSummary: SessionSummary;
};

type AutopilotUpdateMessage = {
	command: 'AUTOPILOT_UPDATE';
	enabled: boolean;
};

type ViewMessage = InitMessage | VibeUpdateMessage | AutopilotUpdateMessage;

// ─── Constants ────────────────────────────────────────────────────────────

const ACTION_DISPLAY: Record<string, string> = {
	laydownflat: 'Lay Down Flat',
	lookaround: 'Look Around'
};

const ACTION_ORDER = [
	'idle', 'thinking', 'coding', 'debugging', 'reviewing', 'refactoring',
	'testing', 'reading', 'success', 'error', 'sleep', 'sit', 'laydown',
	'laydownflat', 'rest', 'running', 'ballet', 'walk', 'wave', 'stretch',
	'dance', 'lookaround', 'shrug', 'peek', 'knocked'
];

const SCENE_PROP_PRESETS: Array<{ label: string; type: string; icon: string }> = [
	{ label: 'Paper', type: 'paper', icon: '📄' },
	{ label: 'Laptop', type: 'laptop', icon: '💻' },
	{ label: 'Book', type: 'book', icon: '📖' },
	{ label: 'Clipboard', type: 'clipboard', icon: '📋' },
	{ label: 'M. Glass', type: 'magnifying_glass', icon: '🔍' },
	{ label: 'Wrench', type: 'wrench', icon: '🔧' },
	{ label: 'Test Tubes', type: 'test_tubes', icon: '🧪' },
	{ label: 'Lightbulb', type: 'lightbulb', icon: '💡' },
	{ label: 'Coffee', type: 'coffee_mug', icon: '☕' },
	{ label: 'Star', type: 'star', icon: '⭐' },
	{ label: 'Trophy', type: 'trophy', icon: '🏆' }
];

const POSITIONS = ['far-left', 'left', 'center-left', 'center', 'center-right', 'right', 'far-right', 'back-left', 'back', 'back-right', 'front', 'front-left', 'front-right'];

const PERSONALITIES = ['supportive', 'sarcastic', 'stoic'] as const;

const PERSONALITY_ICONS: Record<string, string> = {
	supportive: '🤗',
	sarcastic: '😏',
	stoic: '🗿'
};

const TOAST_PRESETS = [
	{ label: '👋 Hi!', text: 'Hey there! Just checking in on you.', mood: 'wave' },
	{ label: '🎉 Great job!', text: "You're doing amazing work today!", mood: 'success' },
	{ label: '😰 Hang in there', text: "It's tough right now, but you'll figure it out.", mood: 'error' },
	{ label: '💤 Take a break', text: 'Maybe step away for a minute? Self-care matters.', mood: 'sleep' },
	{ label: '🤔 Thinking...', text: 'Hmm, let me think about this with you...', mood: 'thinking' },
	{ label: '🐛 Bug found', text: "There's definitely a bug here. Let's hunt it down!", mood: 'debugging' }
];

const DEFAULT_ACTIONS: string[] = ACTION_ORDER;

// ─── Helpers ──────────────────────────────────────────────────────────────

const sortActions = (actions: string[]) => {
	const unique = Array.from(new Set(actions));
	const ordered = unique.filter((action) => ACTION_ORDER.includes(action));
	const remaining = unique.filter((action) => !ACTION_ORDER.includes(action)).sort();
	return [...ordered, ...remaining];
};

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const formatAction = (action: string) => {
	if (ACTION_DISPLAY[action]) {
		return ACTION_DISPLAY[action];
	}
	return action
		.split(/[_-]/g)
		.map((segment) => titleCase(segment))
		.join(' ');
};

const formatTemperatureLabel = (value: number) => {
	if (value < 0.2) { return 'Chill'; }
	if (value < 0.45) { return 'Calm'; }
	if (value < 0.7) { return 'Normal'; }
	if (value < 0.9) { return 'Energetic'; }
	return 'Hyper';
};

function vibeLevelFromScore(score: number): { label: string; emoji: string; color: string } {
	if (score < 15) { return { label: 'Zen', emoji: '🟢', color: 'var(--vscode-terminal-ansiGreen, #6ccf9f)' }; }
	if (score < 35) { return { label: 'Focused', emoji: '🔵', color: 'var(--vscode-terminal-ansiBlue, #6cb6ff)' }; }
	if (score < 55) { return { label: 'Busy', emoji: '🟡', color: 'var(--vscode-terminal-ansiYellow, #e2c08d)' }; }
	if (score < 75) { return { label: 'Stressed', emoji: '🟠', color: 'var(--vscode-terminal-ansiRed, #f48771)' }; }
	return { label: 'Overwhelmed', emoji: '🔴', color: 'var(--vscode-terminal-ansiRed, #f48771)' };
}

function formatMs(ms: number): string {
	const sec = Math.floor(ms / 1000);
	if (sec < 60) { return `${sec}s`; }
	const min = Math.floor(sec / 60);
	if (min < 60) { return `${min}m`; }
	return `${Math.floor(min / 60)}h ${min % 60}m`;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function ControlPanel() {
	const vscode = useMemo(
		() => (typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : { postMessage: () => undefined }),
		[]
	);
	const [autopilotEnabled, setAutopilotEnabled] = useState(true);
	const [actions, setActions] = useState<string[]>(DEFAULT_ACTIONS);
	const [status, setStatus] = useState<'loading' | 'ready'>('loading');
	const [vibe, setVibe] = useState<VibeData | null>(null);
	const [session, setSession] = useState<SessionSummary | null>(null);
	const [personality, setPersonality] = useState('supportive');
	const [vibeReactions, setVibeReactions] = useState(true);
	const [customToast, setCustomToast] = useState('');
	const [temperature, setTemperature] = useState(0.5);

	useEffect(() => {
		const onMessage = (event: MessageEvent<ViewMessage>) => {
			const data = event.data;
			if (!data || typeof data !== 'object') {
				return;
			}
			if (data.command === 'INIT') {
				setActions(sortActions(data.actions ?? []));
				setAutopilotEnabled(data.autopilotEnabled ?? true);
				if (data.vibe) { setVibe(data.vibe); }
				if (data.sessionSummary) { setSession(data.sessionSummary); }
				if (data.personality) { setPersonality(data.personality); }
				if (data.vibeReactions !== undefined) { setVibeReactions(data.vibeReactions); }
				if (typeof data.defaultTemperature === 'number') { setTemperature(data.defaultTemperature); }
				setStatus('ready');
				return;
			}
			if (data.command === 'VIBE_UPDATE') {
				setVibe(data.vibe);
				setSession(data.sessionSummary);
				return;
			}
			if (data.command === 'AUTOPILOT_UPDATE') {
				setAutopilotEnabled(data.enabled);
			}
		};
		window.addEventListener('message', onMessage);
		vscode.postMessage({ command: 'READY' });
		return () => window.removeEventListener('message', onMessage);
	}, [vscode]);

	const handleAutopilotToggle = () => {
		const nextValue = !autopilotEnabled;
		setAutopilotEnabled(nextValue);
		vscode.postMessage({ command: 'SET_AUTOPILOT', enabled: nextValue });
	};

	const handleActionClick = (action: string) => {
		vscode.postMessage({ command: 'FORCE_ACTION', action });
	};

	const handleMoveClick = (target: 'left' | 'front' | 'right') => {
		vscode.postMessage({ command: 'FORCE_MOVE', target });
	};

	const handlePlaceProp = (type: string, autoInteract: boolean) => {
		const position = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
		vscode.postMessage({ command: 'PLACE_SCENE_PROP', propType: type, position, autoInteract });
	};

	const handleClearScene = () => {
		vscode.postMessage({ command: 'CLEAR_SCENE' });
	};

	const handleSendToast = (text: string, mood?: string) => {
		if (!text.trim()) { return; }
		vscode.postMessage({ command: 'SEND_TOAST', text: text.trim(), mood: mood ?? 'idle', durationSeconds: 4 });
	};

	const handlePersonalityChange = (p: string) => {
		setPersonality(p);
		vscode.postMessage({ command: 'SET_PERSONALITY', personality: p });
	};

	const handleVibeReactionsToggle = () => {
		const next = !vibeReactions;
		setVibeReactions(next);
		vscode.postMessage({ command: 'SET_VIBE_REACTIONS', enabled: next });
	};

	const handleTemperatureChange = (nextValue: number) => {
		const clamped = Math.max(0, Math.min(1, nextValue));
		setTemperature(clamped);
		vscode.postMessage({ command: 'SET_TEMPERATURE', temperature: clamped });
	};

	const handleShowSummary = () => {
		vscode.postMessage({ command: 'SHOW_SESSION_SUMMARY' });
	};

	const vibeInfo = vibe ? vibeLevelFromScore(vibe.stressScore) : null;

	return (
		<div className="control-root">
			<header className="control-header">
				<div>
					<p className="eyebrow">Control Panel</p>
					<h1>Robot Actions</h1>
					<p className="subtle">Force actions, toggle autopilot, debug vibes.</p>
				</div>
				<div className="status-chip" data-state={status}>
					{status === 'ready' ? 'Connected' : 'Connecting'}
				</div>
			</header>

		{/* ── Vibe Monitor ───────────────────────────────────────── */}
		<section className="panel">
			<h2>🧠 Workspace Vibe</h2>
			{vibe && vibeInfo ? (
				<>
					<div className="vibe-header">
						<span className="vibe-level" style={{ color: vibeInfo.color }}>
							{vibeInfo.emoji} {vibeInfo.label}
						</span>
						<span className="vibe-score">Stress: {vibe.stressScore}/100</span>
					</div>
					<div className="vibe-bar-container">
						<div className="vibe-bar" style={{ width: `${vibe.stressScore}%`, background: vibeInfo.color }} />
					</div>
					<div className="vibe-details">
						<div className="vibe-detail-row">
							<span>Errors</span>
							<span className={vibe.errorCount > 0 ? 'warn-text' : ''}>{vibe.errorCount}</span>
						</div>
						<div className="vibe-detail-row">
							<span>Warnings</span>
							<span>{vibe.warningCount}</span>
						</div>
						<div className="vibe-detail-row">
							<span>Last Save</span>
							<span>{formatMs(vibe.timeSinceLastSaveMs)}</span>
						</div>
						<div className="vibe-detail-row">
							<span>File Switches</span>
							<span>{vibe.contextSwitchRate}/min</span>
						</div>
						<div className="vibe-detail-row">
							<span>Git</span>
							<span className={vibe.gitState === 'conflicted' ? 'warn-text' : ''}>{vibe.gitState}</span>
						</div>
						{vibe.deletionSpike && (
							<div className="vibe-detail-row">
								<span>⚠️ Deletion Spike</span>
								<span className="warn-text">Detected</span>
							</div>
						)}
					</div>
					<p className="hint" style={{ marginTop: '6px' }}>{vibe.summary}</p>
				</>
			) : (
				<p className="hint">Waiting for vibe data...</p>
			)}
		</section>

		{/* ── Session Summary ─────────────────────────────────────── */}
		{session && (
			<section className="panel">
				<h2>📊 Session ({session.sessionDurationMinutes}m)</h2>
				<div className="vibe-details">
					<div className="vibe-detail-row">
						<span>Avg Stress</span>
						<span>{session.averageStress}/100</span>
					</div>
					<div className="vibe-detail-row">
						<span>Peak Stress</span>
						<span>{session.peakStress}/100</span>
					</div>
					<div className="vibe-detail-row">
						<span>Peak Errors</span>
						<span>{session.peakErrors}</span>
					</div>
				</div>
				{session.vibeJourney && (
					<div className="vibe-journey">
						<span className="hint">Journey: </span>
						<span className="journey-emojis">{session.vibeJourney}</span>
					</div>
				)}
				<div className="panel-row" style={{ marginTop: '8px' }}>
					<button className="btn" type="button" onClick={handleShowSummary}>
						📋 Full Summary
					</button>
				</div>
			</section>
		)}

		{/* ── Personality & Reactions ────────────────────────────── */}
		<section className="panel">
			<h2>🎭 Personality &amp; Reactions</h2>
			<div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
				{PERSONALITIES.map((p) => (
					<button
						key={p}
						className={`btn${personality === p ? ' primary' : ''}`}
						type="button"
						onClick={() => handlePersonalityChange(p)}
					>
						{PERSONALITY_ICONS[p]} {titleCase(p)}
					</button>
				))}
			</div>
			<div className="panel-row" style={{ marginTop: '8px' }}>
				<button
					className={`btn${vibeReactions ? ' primary' : ''}`}
					type="button"
					onClick={handleVibeReactionsToggle}
				>
					Vibe Reactions: {vibeReactions ? 'On' : 'Off'}
				</button>
				<p className="hint">Auto-react to workspace stress.</p>
			</div>
		</section>

		{/* ── Thought Bubble Tester ──────────────────────────────── */}
		<section className="panel">
			<h2>💬 Thought Bubble Tester</h2>
			<p className="hint">Send a test toast to the robot.</p>
			<div className="grid">
				{TOAST_PRESETS.map((preset) => (
					<button
						key={preset.label}
						className="btn"
						type="button"
						onClick={() => handleSendToast(preset.text, preset.mood)}
						title={preset.text}
					>
						{preset.label}
					</button>
				))}
			</div>
			<div className="toast-input-row">
				<input
					className="toast-input"
					type="text"
					placeholder="Custom message..."
					value={customToast}
					onChange={(e) => setCustomToast(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							handleSendToast(customToast);
							setCustomToast('');
						}
					}}
				/>
				<button className="btn primary" type="button" onClick={() => { handleSendToast(customToast); setCustomToast(''); }}>
					Send
				</button>
			</div>
		</section>

		{/* ── Autopilot & Camera ─────────────────────────────────── */}
		<section className="panel">
			<div className="panel-row">
				<button className="btn primary" type="button" onClick={handleAutopilotToggle}>
					Autopilot: {autopilotEnabled ? 'On' : 'Off'}
				</button>
				<p className="hint">Autopilot only moves when the main view is visible.</p>
			</div>
		</section>

		<section className="panel">
			<h2>🔥 Temperature</h2>
			<p className="hint">Control animation intensity (0 = calm, 1 = hyper).</p>
			<div className="temperature-row">
				<input
					className="temperature-slider"
					type="range"
					min={0}
					max={1}
					step={0.05}
					value={temperature}
					onChange={(e) => handleTemperatureChange(Number(e.target.value))}
				/>
				<div className="temperature-value">
					<span>{formatTemperatureLabel(temperature)}</span>
					<span className="temperature-number">{temperature.toFixed(2)}</span>
				</div>
			</div>
		</section>

		<section className="panel">
			<h2>Camera Peeks</h2>
			<div className="grid">
				<button className="btn" type="button" onClick={() => handleMoveClick('left')}>
					Peek Left
				</button>
				<button className="btn" type="button" onClick={() => handleMoveClick('front')}>
					Peek Front
				</button>
				<button className="btn" type="button" onClick={() => handleMoveClick('right')}>
					Peek Right
				</button>
			</div>
		</section>

		{/* ── Scene Props ─────────────────────────────────────────── */}
		<section className="panel">
			<h2>Scene Props</h2>
			<p className="hint">Place props on the ground. Interactive props trigger robot pickup.</p>
			<div className="grid">
				{SCENE_PROP_PRESETS.map((preset) => (
					<button key={preset.type} className="btn" type="button" onClick={() => handlePlaceProp(preset.type, false)}
						title={`Place ${preset.label} on ground`}>
						{preset.icon} {preset.label}
					</button>
				))}
			</div>
			<div className="panel-row" style={{ marginTop: '8px' }}>
				<button className="btn primary" type="button" onClick={handleClearScene}>
					Clear Scene
				</button>
				<p className="hint">Remove all ground props.</p>
			</div>
			<h3 style={{ marginTop: '8px', fontSize: '0.85em', opacity: 0.8 }}>Place &amp; Pick Up</h3>
			<p className="hint">Place a prop and robot auto-walks to pick it up.</p>
			<div className="grid">
				{SCENE_PROP_PRESETS.filter(p => !['coffee_mug', 'star', 'trophy'].includes(p.type)).map((preset) => (
					<button key={`auto-${preset.type}`} className="btn" type="button" onClick={() => handlePlaceProp(preset.type, true)}
						title={`Place ${preset.label} and pick up`}>
						{preset.icon} ➜
					</button>
				))}
			</div>
		</section>

		{/* ── Actions ─────────────────────────────────────────────── */}
		<section className="panel">
			<h2>Available Actions</h2>
			<div className="grid">
				{actions.map((action) => (
					<button key={action} className="btn" type="button" onClick={() => handleActionClick(action)}>
						{formatAction(action)}
					</button>
				))}
			</div>
			<p className="hint">Open the Emotional Support view to see the robot perform.</p>
		</section>
		</div>
	);
}
