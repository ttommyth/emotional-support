import { useState } from 'react';
import type { CSSProperties } from 'react';
import App from './App';
import ControlPanel from './control-panel/ControlPanel';
import './control-panel/control-panel.css';

// Layout proportions for the split view
const ROBOT_VIEW_WIDTH_PERCENT = 60;
const CONTROL_PANEL_WIDTH_PERCENT = 40;

/**
 * Wrapper component that displays the robot view side-by-side with the control panel.
 * This is used for GitHub Pages preview to allow users to easily test features.
 */
export default function AppWithControlPanel() {
	const [isPanelVisible, setIsPanelVisible] = useState(true);

	return (
		<div
			className="app-shell"
			data-panel-visible={isPanelVisible ? 'true' : 'false'}
			style={{ '--panel-width': `${CONTROL_PANEL_WIDTH_PERCENT}%` } as CSSProperties}
		>
			{/* Main robot view */}
			<div className="app-shell__robot" style={{
				flex: isPanelVisible ? `1 1 ${ROBOT_VIEW_WIDTH_PERCENT}%` : '1 1 100%'
			}}>
				<App />
			</div>

			{/* Control panel toggle button */}
			<button
				onClick={() => setIsPanelVisible(!isPanelVisible)}
				className="app-shell__toggle"
				style={{
					'--toggle-right': isPanelVisible ? `${CONTROL_PANEL_WIDTH_PERCENT}%` : '10px'
				} as CSSProperties}
				aria-expanded={isPanelVisible}
				title={isPanelVisible ? 'Hide Control Panel' : 'Show Control Panel'}
			>
				{isPanelVisible ? '◀ Hide Controls' : '▶ Show Controls'}
			</button>

			<div
				className="app-shell__scrim"
				onClick={() => setIsPanelVisible(false)}
				aria-hidden="true"
			/>

			{/* Control panel */}
			<div className="app-shell__panel" style={{
				flex: `0 0 ${CONTROL_PANEL_WIDTH_PERCENT}%`
			}}>
				<ControlPanel />
			</div>
		</div>
	);
}
