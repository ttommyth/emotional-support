import { useEffect, useRef, useState } from 'react';
import { robotActions, actionPropDefs } from '../robot/actions';
import { ACTION_ORDER } from '../robot/action-labels';
import { SCENE_PROP_ACTION_MAP } from '../robot/types';
import type { RobotActionName, ScenePropType } from '../robot/types';
import { runSanityCheck } from './sanity-check';
import type { ActionCheck, PropCheck, SanityReport, ScenePropCheck } from './sanity-check';

const EYE_HEX: Record<string, string> = {
	cyan: '#00d2d3',
	red: '#ff5252',
	green: '#1dd1a1',
	off: '#333333',
	purple: '#a29bfe',
	calm: '#5fbfc0'
};

const SCENE_PROP_ICONS: Record<ScenePropType, string> = {
	paper: '📄',
	laptop: '💻',
	magnifying_glass: '🔍',
	clipboard: '📋',
	wrench: '🔧',
	test_tubes: '🧪',
	lightbulb: '💡',
	book: '📖',
	coffee_mug: '☕',
	star: '⭐',
	trophy: '🏆'
};

const ACTION_DISPLAY_OVERRIDES: Partial<Record<RobotActionName, string>> = {
	laydownflat: 'Lay Down Flat',
	lookaround: 'Look Around',
	inspect: 'Inspect'
};

function displayName(name: RobotActionName): string {
	return ACTION_DISPLAY_OVERRIDES[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

function issuesFor(action: ActionCheck): string[] {
	const issues: string[] = [];
	if (action.applyError) issues.push(`apply: ${action.applyError}`);
	if (action.updateError) issues.push(`update: ${action.updateError}`);
	if (action.preError) issues.push(`pre: ${action.preError}`);
	if (action.postError) issues.push(`post: ${action.postError}`);
	if (action.nanCount > 0) issues.push(`NaN×${action.nanCount}`);
	if (action.exceedsBounds) issues.push('out of bounds');
	if (action.dead) issues.push('no movement');
	return issues;
}

export default function ReviewPanel() {
	const [selected, setSelected] = useState<RobotActionName | null>(null);
	const [cycling, setCycling] = useState(false);
	const [autopilot, setAutopilot] = useState(false);
	const [temperature, setTemperature] = useState(0.5);
	const [report, setReport] = useState<SanityReport | null>(null);
	const [checking, setChecking] = useState(false);
	const cycleTimer = useRef<number | undefined>(undefined);
	const cycleIdx = useRef(0);

	const post = (msg: unknown) => window.postMessage(msg, '*');

	useEffect(() => {
		// Start deterministic: autopilot off at normal temperature so the
		// robot only does what we ask it to.
		post({ command: 'SET_AUTOPILOT', enabled: false });
		post({ command: 'SET_TEMPERATURE', temperature: 0.5 });
		return () => {
			if (cycleTimer.current !== undefined) {
				window.clearInterval(cycleTimer.current);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Optional URL-driven presets for scripted/screenshot verification:
	//   ?action=ballet   → play that action
	//   ?prop=book       → place that scene prop (default pos center, override with ?pos=)
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const actionParam = params.get('action');
		const propParam = params.get('prop');
		const posParam = params.get('pos') ?? 'center';
		const timer = window.setTimeout(() => {
			if (actionParam && actionParam in robotActions) {
				runAction(actionParam as RobotActionName);
			}
			if (propParam && propParam in SCENE_PROP_ACTION_MAP) {
				placeProp(propParam as ScenePropType, posParam);
			}
		}, 400);
		return () => window.clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// ?autocheck=1 → run the automated sanity check on load (for headless
	// verification: the resulting DOM contains the pass/fail report).
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.get('autocheck') !== '1') return;
		const timer = window.setTimeout(runCheck, 500);
		return () => window.clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const runAction = (name: RobotActionName) => {
		setSelected(name);
		// A long duration holds the action. Without it, `updateAI` reverts a
		// zero-duration SET_MOOD back to idle on the next frame.
		post({ command: 'SET_MOOD', mood: name, durationSeconds: 3600 });
	};

	const startCycle = () => {
		if (cycleTimer.current !== undefined) return;
		setCycling(true);
		cycleIdx.current = 0;
		runAction(ACTION_ORDER[0]);
		cycleTimer.current = window.setInterval(() => {
			cycleIdx.current = (cycleIdx.current + 1) % ACTION_ORDER.length;
			runAction(ACTION_ORDER[cycleIdx.current]);
		}, 3500);
	};

	const stopCycle = () => {
		if (cycleTimer.current !== undefined) {
			window.clearInterval(cycleTimer.current);
			cycleTimer.current = undefined;
		}
		setCycling(false);
	};

	const onTemp = (v: number) => {
		setTemperature(v);
		post({ command: 'SET_TEMPERATURE', temperature: v });
	};

	const onAutopilot = (v: boolean) => {
		setAutopilot(v);
		post({ command: 'SET_AUTOPILOT', enabled: v });
	};

	const placeProp = (type: ScenePropType, pos = 'center') => {
		post({
			command: 'PLACE_SCENE_PROP',
			propId: `review-${type}-${Date.now()}`,
			propType: type,
			position: pos,
			autoInteract: false
		});
	};

	const clearScene = () => post({ command: 'SET_SCENE', props: [] });

	const runCheck = () => {
		if (checking) return;
		setChecking(true);
		setTimeout(() => {
			try {
				setReport(runSanityCheck());
			} catch (err) {
				setReport(null);
				console.error('sanity check failed', err);
			} finally {
				setChecking(false);
			}
		}, 30);
	};

	const selectedDef = selected ? robotActions[selected] : null;
	const selectedProp = selected ? actionPropDefs.get(selected) : undefined;
	const actionIssues = report ? report.actions.filter((a) => issuesFor(a).length > 0) : [];
	const propIssues = report ? report.props.filter((p) => p.buildError || p.nanCount > 0) : [];
	const scenePropIssues = report ? report.sceneProps.filter((p) => p.buildError || p.nanCount > 0) : [];

	return (
		<div className="control-root review-root">
			<header className="control-header">
				<div>
					<p className="eyebrow">Dev Review</p>
					<h1>Actions &amp; Props</h1>
					<p className="subtle">Verify each action and prop one by one.</p>
				</div>
			</header>

			{/* ── Now playing banner ─────────────────────────── */}
			<section className="panel">
				<h2>▶ Now Playing</h2>
				{selected && selectedDef ? (
					<div className="now-playing">
						<div className="now-playing__row">
							<span className="now-playing__name">{displayName(selected)}</span>
							{selectedDef.eyeColor && (
								<span
									className="eye-dot"
									title={`eye: ${selectedDef.eyeColor}`}
									style={{ background: EYE_HEX[selectedDef.eyeColor] ?? '#ccc' }}
								/>
							)}
							{selectedProp && <span className="chip">📦 prop</span>}
						</div>
						<div className="tag-row">
							{(selectedDef.tags ?? []).map((t) => (
								<span key={t} className="tag">{t}</span>
							))}
							{selectedDef.pre && <span className="tag tag--transition">pre</span>}
							{selectedDef.post && <span className="tag tag--transition">post</span>}
							{selectedDef.update && <span className="tag tag--transition">update</span>}
						</div>
						{selectedProp && (
							<p className="hint">
								anchor=({selectedProp.anchor.position.join(', ')}) rot=({selectedProp.anchor.rotation.map((v) => v.toFixed(2)).join(', ')})
							</p>
						)}
					</div>
				) : (
					<p className="hint">Click an action below to play it.</p>
				)}
			</section>

			{/* ── Controls ───────────────────────────────────── */}
			<section className="panel">
				<div className="panel-row">
					<button
						className={`btn${cycling ? ' primary' : ''}`}
						type="button"
						onClick={cycling ? stopCycle : startCycle}
					>
						{cycling ? '⏹ Stop Cycle' : '▶ Cycle All Actions'}
					</button>
					<button
						className={`btn${autopilot ? ' primary' : ''}`}
						type="button"
						onClick={() => onAutopilot(!autopilot)}
						title="Let the robot wander on its own (may override manual actions)"
					>
						Autopilot: {autopilot ? 'On' : 'Off'}
					</button>
				</div>
				<div className="temperature-row">
					<span className="hint">Temperature</span>
					<input
						className="temperature-slider"
						type="range"
						min={0}
						max={1}
						step={0.05}
						value={temperature}
						onChange={(e) => onTemp(Number(e.target.value))}
					/>
					<span className="temperature-number">{temperature.toFixed(2)}</span>
				</div>
			</section>

			{/* ── Actions ────────────────────────────────────── */}
			<section className="panel">
				<h2>Robot Actions ({ACTION_ORDER.length})</h2>
				<div className="grid">
					{ACTION_ORDER.map((action) => (
						<button
							key={action}
							className={`btn${selected === action ? ' primary' : ''}`}
							type="button"
							onClick={() => runAction(action)}
							title={`${action}${robotActions[action].eyeColor ? ` · eye ${robotActions[action].eyeColor}` : ''}${actionPropDefs.has(action) ? ' · has prop' : ''}`}
						>
							{displayName(action)}
						</button>
					))}
				</div>
			</section>

			{/* ── Scene props ────────────────────────────────── */}
			<section className="panel">
				<h2>Scene Props</h2>
				<p className="hint">Place a prop at the center of the floor. Interactive types can be picked up by the robot.</p>
				<div className="grid">
					{(Object.keys(SCENE_PROP_ACTION_MAP) as ScenePropType[]).map((type) => (
						<button key={type} className="btn" type="button" onClick={() => placeProp(type)} title={type}>
							{SCENE_PROP_ICONS[type]} {type.replace('_', ' ')}
						</button>
					))}
				</div>
				<div className="panel-row" style={{ marginTop: '8px' }}>
					<button className="btn" type="button" onClick={clearScene}>
						Clear Scene
					</button>
					<p className="hint">Remove all ground props.</p>
				</div>
			</section>

			{/* ── Sanity check ───────────────────────────────── */}
			<section className="panel">
				<div className="panel-row">
					<button className="btn primary" type="button" onClick={runCheck} disabled={checking}>
						{checking ? 'Running…' : report ? '↻ Re-run Check' : '▶ Run Automated Check'}
					</button>
					<p className="hint">Exercises every action/prop headlessly; flags NaN, bounds, dead actions, broken meshes.</p>
				</div>
				{report && (
					<div className="review-results">
						<p className="review-summary">
							{report.actions.length} actions · {report.props.length} action props · {report.sceneProps.length} scene props
							{actionIssues.length === 0 && propIssues.length === 0 && scenePropIssues.length === 0 && (
								<> · <strong style={{ color: '#1dd1a1' }}>all valid ✓</strong></>
							)}
						</p>
						{actionIssues.length > 0 && (
							<table className="review-table">
								<thead><tr><th>Action</th><th>Issues</th></tr></thead>
								<tbody>
									{actionIssues.map((a) => (
										<tr key={a.name}><td>{a.name}</td><td>{issuesFor(a).join('; ')}</td></tr>
									))}
								</tbody>
							</table>
						)}
						{propIssues.length > 0 && (
							<table className="review-table">
								<thead><tr><th>Prop</th><th>Issues</th></tr></thead>
								<tbody>
									{propIssues.map((p) => (
										<tr key={p.name}><td>{p.name}</td><td>{p.buildError ?? `NaN×${p.nanCount}`}</td></tr>
									))}
								</tbody>
							</table>
						)}
						{scenePropIssues.length > 0 && (
							<table className="review-table">
								<thead><tr><th>Scene prop</th><th>Issues</th></tr></thead>
								<tbody>
									{scenePropIssues.map((p) => (
										<tr key={p.type}><td>{p.type}</td><td>{p.buildError ?? `NaN×${p.nanCount}`}</td></tr>
									))}
								</tbody>
							</table>
						)}
						<details>
							<summary>Show per-action details</summary>
							<ActionTable actions={report.actions} />
							<PropTable props={report.props} />
							<ScenePropTable sceneProps={report.sceneProps} />
						</details>
					</div>
				)}
			</section>
		</div>
	);
}

function ActionTable({ actions }: { actions: ActionCheck[] }) {
	return (
		<table className="review-table">
			<thead>
				<tr><th>Action</th><th>eye</th><th>prop</th><th>nan</th><th>maxAbs</th><th>amp</th><th>pre/post/upd</th><th>issues</th></tr>
			</thead>
			<tbody>
				{actions.map((a) => (
					<tr key={a.name}>
						<td>{a.name}</td>
						<td>{a.eyeColor ?? '-'}</td>
						<td>{a.hasProp ? '✓' : '-'}</td>
						<td>{a.nanCount}</td>
						<td>{a.maxAbs.toFixed(3)}</td>
						<td>{a.amplitude.toFixed(3)}</td>
						<td>{[a.hasPre ? 'pre' : '', a.hasPost ? 'post' : '', a.hasUpdate ? 'upd' : ''].filter(Boolean).join('/') || '-'}</td>
						<td>{issuesFor(a).join('; ') || 'ok'}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

function PropTable({ props }: { props: PropCheck[] }) {
	return (
		<table className="review-table">
			<thead>
				<tr><th>Prop</th><th>nodes</th><th>meshes</th><th>size</th><th>anchor</th></tr>
			</thead>
			<tbody>
				{props.map((p) => (
					<tr key={p.name}>
						<td>{p.name}</td>
						<td>{p.nodeCount}</td>
						<td>{p.meshCount}</td>
						<td>{p.size.toFixed(2)}</td>
						<td>({p.anchorPos.map((v) => v.toFixed(2)).join(', ')})</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

function ScenePropTable({ sceneProps }: { sceneProps: ScenePropCheck[] }) {
	return (
		<table className="review-table">
			<thead>
				<tr><th>Scene prop</th><th>nodes</th><th>meshes</th><th>size</th></tr>
			</thead>
			<tbody>
				{sceneProps.map((p) => (
					<tr key={p.type}>
						<td>{p.type}</td>
						<td>{p.nodeCount}</td>
						<td>{p.meshCount}</td>
						<td>{p.size.toFixed(2)}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
