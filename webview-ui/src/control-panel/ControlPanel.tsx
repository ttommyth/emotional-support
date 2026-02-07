import { useEffect, useMemo, useState } from 'react';

declare const acquireVsCodeApi: (() => { postMessage: (message: unknown) => void }) | undefined;

type ViewMessage = {
	command: 'INIT';
	actions: string[];
	autopilotEnabled: boolean;
};

const ACTION_DISPLAY: Record<string, string> = {
	laydownflat: 'Lay Down Flat',
	lookaround: 'Look Around'
};

const ACTION_ORDER = [
	'idle',
	'thinking',
	'coding',
	'debugging',
	'reviewing',
	'refactoring',
	'testing',
	'reading',
	'success',
	'error',
	'sleep',
	'sit',
	'laydown',
	'laydownflat',
	'rest',
	'running',
	'ballet',
	'walk',
	'wave',
	'stretch',
	'dance',
	'lookaround',
	'shrug',
	'peek',
	'knocked'
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

const DEFAULT_ACTIONS: string[] = ACTION_ORDER;

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

export default function ControlPanel() {
	const vscode = useMemo(
		() => (typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : { postMessage: () => undefined }),
		[]
	);
	const [autopilotEnabled, setAutopilotEnabled] = useState(true);
	const [actions, setActions] = useState<string[]>(DEFAULT_ACTIONS);
	const [status, setStatus] = useState<'loading' | 'ready'>('loading');

	useEffect(() => {
		const onMessage = (
			event: MessageEvent<ViewMessage | { command: 'AUTOPILOT_UPDATE'; enabled: boolean }>
		) => {
			const data = event.data;
			if (!data || typeof data !== 'object') {
				return;
			}
			if (data.command === 'INIT') {
				setActions(sortActions(data.actions ?? []));
				setAutopilotEnabled(data.autopilotEnabled ?? true);
				setStatus('ready');
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

	return (
		<div className="control-root">
			<header className="control-header">
				<div>
					<p className="eyebrow">Control Panel</p>
					<h1>Robot Actions</h1>
					<p className="subtle">Force actions, toggle autopilot, and trigger camera peeks.</p>
				</div>
				<div className="status-chip" data-state={status}>
					{status === 'ready' ? 'Connected' : 'Connecting'}
				</div>
			</header>

		<section className="panel">
			<div className="panel-row">
				<button className="btn primary" type="button" onClick={handleAutopilotToggle}>
					Autopilot: {autopilotEnabled ? 'On' : 'Off'}
				</button>
				<p className="hint">Autopilot only moves when the main view is visible.</p>
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
