import * as path from 'path';
import * as vscode from 'vscode';
import type { AgentActivity, AgentActivityKind, AgentActivityProvider, AgentActivitySink } from './agent-activity';

/**
 * Heuristic agent-activity monitor that works in ANY VS Code-based IDE
 * (Copilot, Cursor, others) with zero cooperation from the agent.
 *
 * VS Code does not tell us *who* caused an event, so we look for signatures of
 * programmatic agent work rather than human typing:
 *   - burst edits (large single changes, or several files changed quickly)
 *   - file create / delete / rename
 *   - terminal commands & tasks (tests, builds, debuggers)
 *   - debug sessions
 *   - rapid document opens (a proxy for "the agent is reading files")
 *   - new diagnostics errors shortly after an agent edit
 */
export class VscodeAgentActivityMonitor implements AgentActivityProvider {
	readonly id = 'vscode-heuristics';
	private sink: AgentActivitySink | undefined;
	private readonly disposables: vscode.Disposable[] = [];

	private editEvents: Array<{ uri: string; chars: number; time: number }> = [];
	private openEvents: Array<{ file: string; time: number }> = [];
	private lastEditEmit = 0;
	private lastReadEmit = 0;
	private lastErrorCount = 0;
	private runId = '';
	private lastRunActivity = 0;

	start(sink: AgentActivitySink) {
		this.sink = sink;
		this.disposables.push(
			vscode.workspace.onDidChangeTextDocument((e) => this.onEdit(e)),
			vscode.workspace.onDidCreateFiles((e) => this.onFileOp(e.files)),
			vscode.workspace.onDidDeleteFiles((e) => this.onFileOp(e.files)),
			vscode.workspace.onDidRenameFiles((e) => this.onFileOp(e.files.map((f) => f.newUri))),
			vscode.window.onDidStartTerminalShellExecution((e) => this.onTerminal(e.execution.commandLine.value)),
			vscode.tasks.onDidStartTask((e) => this.onTask(e.execution.task.name)),
			vscode.debug.onDidStartDebugSession((s) => this.onDebug(s)),
			vscode.workspace.onDidOpenTextDocument((d) => this.onOpen(d)),
			vscode.languages.onDidChangeDiagnostics(() => this.onDiagnostics())
		);
	}

	dispose() {
		for (const d of this.disposables) {
			d.dispose();
		}
		this.disposables.length = 0;
		this.sink = undefined;
	}

	// ─── Emit helpers ──────────────────────────────────────────────────

	/**
	 * Consecutive signals within RUN_GAP_MS group into one synthetic "run"
	 * session; a gap starts a fresh one. This is our best proxy for separating
	 * distinct agent sessions on the heuristic path (the Cursor hook bridge and
	 * Copilot tool carry real conversation ids).
	 */
	private runSessionId(now: number): string {
		if (!this.runId || now - this.lastRunActivity > RUN_GAP_MS) {
			this.runId = `heuristic-${now}`;
		}
		this.lastRunActivity = now;
		return this.runId;
	}

	private emit(kind: AgentActivityKind, detail?: string, severity?: AgentActivity['severity']) {
		if (!this.sink) {
			return;
		}
		const now = Date.now();
		this.sink({ sessionId: this.runSessionId(now), kind, detail, severity, timestamp: now });
	}

	// ─── Signal handlers ───────────────────────────────────────────────

	private onEdit(e: vscode.TextDocumentChangeEvent) {
		const uri = e.document.uri;
		if (uri.scheme !== 'file' || uri.fsPath.includes('node_modules')) {
			return;
		}
		let chars = 0;
		for (const c of e.contentChanges) {
			chars += c.text.length;
		}
		const now = Date.now();
		this.editEvents = this.editEvents.filter((ev) => now - ev.time < EDIT_BURST_WINDOW_MS);
		this.editEvents.push({ uri: uri.toString(), chars, time: now });

		const activeUri = vscode.window.activeTextEditor?.document.uri.toString();
		const recent = this.editEvents.filter((ev) => now - ev.time < EDIT_BURST_WINDOW_MS);
		const distinctFiles = new Set(recent.map((ev) => ev.uri)).size;
		const totalChars = recent.reduce((sum, ev) => sum + ev.chars, 0);

		const agentLike = chars >= SINGLE_CHANGE_THRESHOLD || distinctFiles >= 2 || totalChars >= BURST_TOTAL_THRESHOLD;
		// Small single-file change in the focused editor looks like human typing — leave that to the vibe service.
		const typingLike = activeUri === uri.toString() && chars < SINGLE_CHANGE_THRESHOLD && distinctFiles < 2;
		if (!agentLike || typingLike) {
			return;
		}
		if (now - this.lastEditEmit < EDIT_EMIT_COOLDOWN_MS) {
			return;
		}
		this.lastEditEmit = now;
		this.emit('editing', path.basename(e.document.fileName));
	}

	private onFileOp(files: readonly vscode.Uri[]) {
		const first = files[0];
		this.emit('editing', first ? path.basename(first.fsPath) : undefined);
	}

	private onTerminal(commandLine: string) {
		const kind = classifyCommand(commandLine ?? '');
		if (!kind) {
			return;
		}
		this.emit(kind, (commandLine ?? '').slice(0, 80).trim());
	}

	private onTask(name: string) {
		const lower = (name ?? '').toLowerCase();
		const kind: AgentActivityKind = /test/.test(lower) ? 'testing' : 'building';
		this.emit(kind, name);
	}

	private onDebug(session: vscode.DebugSession) {
		this.emit('debugging', session.name || 'debug session');
	}

	/** Rapid document opens are the best generic proxy for "the agent is reading files". */
	private onOpen(doc: vscode.TextDocument) {
		if (doc.uri.scheme !== 'file' || doc.uri.fsPath.includes('node_modules')) {
			return;
		}
		const now = Date.now();
		this.openEvents = this.openEvents.filter((ev) => now - ev.time < READ_BURST_WINDOW_MS);
		this.openEvents.push({ file: path.basename(doc.fileName), time: now });
		if (this.openEvents.length < READ_BURST_COUNT) {
			return;
		}
		if (now - this.lastReadEmit < READ_EMIT_COOLDOWN_MS) {
			return;
		}
		this.lastReadEmit = now;
		this.emit('reading', this.openEvents[this.openEvents.length - 1].file);
	}

	/** New diagnostics errors shortly after an agent edit are the agent's fault. */
	private onDiagnostics() {
		const now = Date.now();
		if (now - this.lastEditEmit > ERROR_AFTER_EDIT_MS) {
			return;
		}
		let errors = 0;
		for (const [uri, diags] of vscode.languages.getDiagnostics()) {
			if (uri.scheme !== 'file' || uri.fsPath.includes('node_modules')) {
				continue;
			}
			for (const d of diags) {
				if (d.severity === vscode.DiagnosticSeverity.Error) {
					errors++;
				}
			}
		}
		if (errors > this.lastErrorCount) {
			this.lastErrorCount = errors;
			this.emit('error', undefined, 'error');
		} else {
			this.lastErrorCount = errors;
		}
	}
}

// ─── Tunables ─────────────────────────────────────────────────────────────

const EDIT_BURST_WINDOW_MS = 2500;
const SINGLE_CHANGE_THRESHOLD = 400; // chars in one content change
const BURST_TOTAL_THRESHOLD = 900; // chars across the window
const EDIT_EMIT_COOLDOWN_MS = 4000;
const READ_BURST_WINDOW_MS = 3000;
const READ_BURST_COUNT = 2; // distinct files opened quickly
const READ_EMIT_COOLDOWN_MS = 6000;
const RUN_GAP_MS = 20_000; // inactivity that separates heuristic "runs"
const ERROR_AFTER_EDIT_MS = 5000;

const TEST_RE = /\b(npm\s+(run\s+)?test|npx\s+[^\s]*(test|vitest|jest|mocha)|pytest|go\s+test|cargo\s+test|deno\s+test)\b/i;
const BUILD_RE = /\b((npm|pnpm|yarn)\s+run\s+(build|compile)|npx\s+[^\s]*(build|tsc|webpack|vite)|(make|cmake|gradle|mvn)\s+(build|compile)|tsc)\b/i;
const DEBUG_RE = /\b(debug|gdb|lldb|pdb)\b/i;
const GIT_EDIT_RE = /\bgit\s+(commit|push|pull|merge|rebase)\b/i;

function classifyCommand(cmd: string): AgentActivityKind | undefined {
	if (TEST_RE.test(cmd)) {
		return 'testing';
	}
	if (BUILD_RE.test(cmd)) {
		return 'building';
	}
	if (DEBUG_RE.test(cmd)) {
		return 'debugging';
	}
	if (GIT_EDIT_RE.test(cmd)) {
		return 'editing';
	}
	return undefined;
}
