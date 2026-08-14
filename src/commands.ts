import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PET_ACTIONS, SCENE_PROP_TYPES, SCENE_POSITIONS } from './domain/actions';
import { getOutputChannel } from './extension';
import type { PetViewProvider } from './webview/pet-view/PetViewProvider';
import type { MoodHistoryService } from './services/mood-history-service';
import type { WorkspaceVibeService } from './services/workspace-vibe-service';

/**
 * Registers all `emotional-support.*` commands.
 */
export function registerCommands(
	context: vscode.ExtensionContext,
	deps: {
		petViewProvider: PetViewProvider;
		moodHistory: MoodHistoryService;
		vibeService: WorkspaceVibeService;
	}
): void {
	const { petViewProvider, moodHistory, vibeService } = deps;

	context.subscriptions.push(
		vscode.commands.registerCommand('emotional-support.showOutput', () => {
			getOutputChannel().show(true);
		}),
		vscode.commands.registerCommand('emotional-support.clearOutput', () => {
			getOutputChannel().clear();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('emotional-support.setPetMood', async () => {
			if (!petViewProvider.isReady()) {
				vscode.window.showInformationMessage('Open the Emotional Support view first.');
				return;
			}
			const currentMood = petViewProvider.getCurrentMood() ?? 'idle';
			const nextIndex = (PET_ACTIONS.indexOf(currentMood) + 1) % PET_ACTIONS.length;
			const nextMood = PET_ACTIONS[nextIndex];
			petViewProvider.setMood({ mood: nextMood });
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('emotional-support.showSessionSummary', () => {
			moodHistory.printSummary();
			getOutputChannel().show(true);
		}),
		vscode.commands.registerCommand('emotional-support.showVibeStatus', () => {
			const vibe = vibeService.getCurrentVibe();
			const ch = getOutputChannel();
			ch.appendLine('');
			ch.appendLine(`\u2500\u2500\u2500 Current Vibe \u2500\u2500\u2500`);
			ch.appendLine(`  Stress:    ${vibe.stressScore}/100`);
			ch.appendLine(`  Errors:    ${vibe.errorCount}`);
			ch.appendLine(`  Warnings:  ${vibe.warningCount}`);
			ch.appendLine(`  Git:       ${vibe.gitState}`);
			ch.appendLine(`  Summary:   ${vibe.summary}`);
			ch.appendLine('');
			ch.show(true);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('emotional-support.installUserHook', async () => {
			const ideName = (vscode.env.appName || '').toLowerCase();
			const isCursor = ideName.includes('cursor');
			if (!isCursor) {
				const pick = await vscode.window.showQuickPick(
					['Install for Cursor', 'Show instructions', 'Cancel'],
					{ placeHolder: 'This installer is specific to Cursor. Choose an action.' }
				);
				if (!pick || pick === 'Cancel') {
					return;
				}
				if (pick === 'Show instructions') {
					try {
						const readmePath = context.asAbsolutePath(path.join('hooks-samples', 'README.md'));
						const doc = await vscode.workspace.openTextDocument(readmePath);
						await vscode.window.showTextDocument(doc, { preview: true });
					} catch {
						vscode.window.showInformationMessage('See hooks-samples/README.md for setup instructions.');
					}
					return;
				}
				// fall through to install if user chose Install for Cursor
			}
			// Proceed with installing user-level Cursor hook
			try {
				const samplePath = context.asAbsolutePath(path.join('hooks-samples', 'user-emotional-support-hook.js'));
				const homeDir = process.env.HOME || process.env.USERPROFILE;
				if (!homeDir) {
					vscode.window.showErrorMessage('Cannot determine user home directory.');
					return;
				}
				const destDir = path.join(homeDir, '.cursor', 'hooks');
				await fs.promises.mkdir(destDir, { recursive: true });
				const destPath = path.join(destDir, 'emotional-support-hook.js');
				await fs.promises.copyFile(samplePath, destPath);
				// Try to set executable bit on POSIX systems
				try {
					if (process.platform !== 'win32') {
						await fs.promises.chmod(destPath, 0o755);
					}
				} catch {}
				// Ensure user hooks config exists
				const hooksJsonPath = path.join(homeDir, '.cursor', 'hooks.json');
				let hooksConfig: any = { version: 1, hooks: {} };
				try {
					const existing = await fs.promises.readFile(hooksJsonPath, 'utf8');
					hooksConfig = JSON.parse(existing);
				} catch {
					hooksConfig = { version: 1, hooks: {} };
				}
				// Add entries for events if not present
				const events = ['beforeReadFile', 'afterFileEdit', 'afterAgentThought', 'beforeSubmitPrompt', 'postToolUseFailure', 'afterAgentResponse'];
				hooksConfig.hooks = hooksConfig.hooks || {};
				events.forEach((e) => {
					if (!Array.isArray(hooksConfig.hooks[e])) {
						hooksConfig.hooks[e] = [];
					}
					const rel = `./hooks/emotional-support-hook.js`;
					if (!hooksConfig.hooks[e].some((h: any) => h && h.command === rel)) {
						hooksConfig.hooks[e].push({ command: rel });
					}
				});
				await fs.promises.writeFile(hooksJsonPath, JSON.stringify(hooksConfig, null, 2), 'utf8');
				vscode.window.showInformationMessage('Installed user-level Emotional Support hook to your home Cursor hooks. Restart Cursor to activate.');
			} catch (err) {
				vscode.window.showErrorMessage(`Failed to install hook: ${String(err)}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('emotional-support.placeSceneProp', async () => {
			if (!petViewProvider.isReady()) {
				vscode.window.showInformationMessage('Open the Emotional Support view first.');
				return;
			}
			const propType = await vscode.window.showQuickPick(
				SCENE_PROP_TYPES.map(t => ({ label: t, description: SCENE_PROP_TYPES.indexOf(t) < 8 ? 'Interactive' : 'Decoration' })),
				{ placeHolder: 'Choose a prop type to place on the ground' }
			);
			if (!propType) {return;}
			const position = await vscode.window.showQuickPick(
				[...SCENE_POSITIONS, 'random'] as string[],
				{ placeHolder: 'Choose a position' }
			);
			if (!position) {return;}
			const autoInteract = await vscode.window.showQuickPick(
				[{ label: 'Yes', description: 'Robot walks to prop and picks it up' }, { label: 'No', description: 'Just place the prop' }],
				{ placeHolder: 'Auto-interact?' }
			);
			if (!autoInteract) {return;}
			const propId = `cmd-${Date.now()}`;
			petViewProvider.placeSceneProp({
				propId,
				propType: propType.label,
				position: position === 'random' ? undefined : position,
				autoInteract: autoInteract.label === 'Yes'
			});
		}),
		vscode.commands.registerCommand('emotional-support.clearScene', () => {
			if (!petViewProvider.isReady()) {
				vscode.window.showInformationMessage('Open the Emotional Support view first.');
				return;
			}
			petViewProvider.setScene({ props: [] });
			vscode.window.showInformationMessage('Scene cleared.');
		})
	);
}
