import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AppWithControlPanel from './AppWithControlPanel';
import './style.css';

// Use AppWithControlPanel for GitHub Pages build, regular App for VS Code extension
// In dev mode, use VITE_GITHUB_PAGES env var; in production, use __GITHUB_PAGES__ define
const isGitHubPages = import.meta.env.VITE_GITHUB_PAGES === 'true' || __GITHUB_PAGES__;
const RootComponent = isGitHubPages ? AppWithControlPanel : App;

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<RootComponent />
	</React.StrictMode>
);
