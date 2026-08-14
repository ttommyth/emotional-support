import { useCallback, useEffect, useRef, useState } from 'react';
import { setupRobotScene } from './app/RobotScene';

declare const acquireVsCodeApi: (() => { postMessage: (message: unknown) => void }) | undefined;

/**
 * Thin React shell. All 3D scene, animation, AI, interaction and message
 * handling lives in `app/RobotScene.ts` (see `setupRobotScene`).
 */
export default function App() {
	const [toasts, setToasts] = useState<Array<{ id: number; text: string; fading: boolean }>>([]);
	const toastIdRef = useRef(0);
	const showThoughtBubblesRef = useRef(true);
	const thoughtBubbleDurationRef = useRef(8);
	const bubbleContainerRef = useRef<HTMLDivElement>(null);
	/** Updated every frame from the render loop to position the bubble above the robot */
	const bubbleScreenPosRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.1 });

	const addToast = useCallback((text: string) => {
		if (!showThoughtBubblesRef.current || !text) return;
		const id = ++toastIdRef.current;
		setToasts((prev) => [...prev.slice(-1), { id, text, fading: false }]); // keep max 2
		const dur = thoughtBubbleDurationRef.current * 1000;
		setTimeout(() => {
			setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, fading: true } : t)));
		}, dur - 800);
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id));
		}, dur);
	}, []);

	useEffect(() => {
		const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : { postMessage: () => undefined };
		const container = document.getElementById('canvas-container') as HTMLDivElement | null;
		if (!container) {
			return;
		}
		return setupRobotScene({
			containerEl: container,
			vscode,
			addToast,
			bubbleScreenPosRef,
			bubbleContainerRef,
			showThoughtBubblesRef,
			thoughtBubbleDurationRef
		});
	}, []);

	return (
		<>
			<div id="canvas-container" />
			{toasts.length > 0 && (
				<div
					ref={bubbleContainerRef}
					className="thought-bubble-container"
					style={{
						left: `${(bubbleScreenPosRef.current.x * 100).toFixed(1)}%`,
						top: `${(bubbleScreenPosRef.current.y * 100).toFixed(1)}%`
					}}
				>
					{toasts.map((toast) => (
						<div key={toast.id} className={`thought-bubble${toast.fading ? ' thought-bubble--fading' : ''}`}>
							<span className="thought-bubble__text">{toast.text}</span>
							<div className="thought-bubble__tail" />
						</div>
					))}
				</div>
			)}
		</>
	);
}
