import { useState } from 'react';
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
		<div style={{
			display: 'flex',
			width: '100%',
			height: '100%',
			overflow: 'hidden'
		}}>
			{/* Main robot view */}
			<div style={{
				flex: isPanelVisible ? `1 1 ${ROBOT_VIEW_WIDTH_PERCENT}%` : '1 1 100%',
				height: '100%',
				position: 'relative',
				transition: 'flex 0.3s ease-in-out'
			}}>
				<App />
			</div>

			{/* Control panel toggle button */}
			<button
				onClick={() => setIsPanelVisible(!isPanelVisible)}
				style={{
					position: 'absolute',
					top: '10px',
					right: isPanelVisible ? `${CONTROL_PANEL_WIDTH_PERCENT}%` : '10px',
					zIndex: 1000,
					padding: '8px 12px',
					background: 'var(--vscode-button-background)',
					color: 'var(--vscode-button-foreground)',
					border: 'none',
					borderRadius: '4px',
					cursor: 'pointer',
					fontSize: '12px',
					fontWeight: '600',
					transition: 'right 0.3s ease-in-out',
					boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
				}}
				title={isPanelVisible ? 'Hide Control Panel' : 'Show Control Panel'}
			>
				{isPanelVisible ? '◀ Hide Controls' : '▶ Show Controls'}
			</button>

			{/* Control panel */}
			{isPanelVisible && (
				<div style={{
					flex: `0 0 ${CONTROL_PANEL_WIDTH_PERCENT}%`,
					height: '100%',
					overflowY: 'auto',
					overflowX: 'hidden',
					borderLeft: '1px solid var(--vscode-panel-border, rgba(128,128,128,0.2))',
					background: 'var(--vscode-sideBar-background)',
					transition: 'flex 0.3s ease-in-out'
				}}>
					<ControlPanel />
				</div>
			)}
		</div>
	);
}
