import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AppWithControlPanel from './AppWithControlPanel';
import './style.css';

// Use AppWithControlPanel for GitHub Pages build, regular App for VS Code extension
const RootComponent = __GITHUB_PAGES__ ? AppWithControlPanel : App;

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<RootComponent />
	</React.StrictMode>
);
