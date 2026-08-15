import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ReviewPanel from './review/ReviewPanel';
import './style.css';
import './control-panel/control-panel.css';
import './review/review.css';

/**
 * Dev-only review page: live robot on the left, per-action/prop verification
 * panel on the right. Access via the Vite dev server at /dev-review.html.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<div className="review-shell">
			<div className="review-shell__robot">
				<App />
			</div>
			<div className="review-shell__panel">
				<ReviewPanel />
			</div>
		</div>
	</React.StrictMode>
);
