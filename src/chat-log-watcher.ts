import * as fs from 'fs';
import * as path from 'path';
import type * as vscode from 'vscode';
import type { PetAction, PetMoodPayload } from './pet-mood-service';

/**
 * Directory names that hold chat session files under each workspace hash dir.
 * VS Code Copilot Chat stores sessions at `<workspaceStorage>/<hash>/chatSessions/`.
 */
const CHAT_SESSION_DIRS = ['chatSessions'];

/** Minimum time between mood emissions (ms). */
const EMIT_DEBOUNCE_MS = 5_000;

// -- Internal types -----------------------------------------------------------

type DetectedActivity = {
	source: 'copilot';
	type: 'tool_call' | 'response' | 'error' | 'active' | 'editing' | 'working';
	toolName?: string;
	timestamp: number;
};

type Indicators = {
	hasError: boolean;
	hasWarning: boolean;
	lastToolName?: string;
	hasRecentResponse: boolean;
	hasEditing: boolean;
	isActive: boolean;
};

export type ChatLogStatus = {
enabled: boolean;
storageRoot: string | undefined;
watchedPaths: string[];
lazyWatching: boolean;
lastActivityTime: number | undefined;
lastActivityType: string | undefined;
totalEventsDetected: number;
};

// -- Service ------------------------------------------------------------------

/**
 * Watches GitHub Copilot Chat session files to detect developer / AI
 * interaction patterns and emit corresponding robot moods.
 *
 * Scans ALL workspace hash directories under `storageRoot` for
 * `chatSessions/*.jsonl` files so it catches whichever workspace window
 * Copilot is active in (not just the extension host own hash).
 *
 * Session files use a differential JSONL format: each line is a JSON patch
 * operation with a numeric `kind`, a path array `k`, and a value `v`.
 * When `k` includes "response", `v` is an array of response items — each
 * item has a string `kind` and optionally a `toolId` identifying the tool
 * that was called.
 *
 * Cursor support is excluded — its SQLite-based storage requires a different
 * parsing approach.
 *
 * Disabled by default — must be enabled via the
 * `emotional-support.chatLogListening` setting.
 */
export class ChatLogWatcher implements vscode.Disposable {
private readonly watchers: fs.FSWatcher[] = [];
private readonly lazyWatchers: fs.FSWatcher[] = [];
private readonly watchedPaths: string[] = [];
private readonly readTimers = new Map<string, NodeJS.Timeout>();
private readonly lastFileContent = new Map<string, string>();
private lastEmitTime = 0;
private debounceTimer: NodeJS.Timeout | undefined;
private pendingActivity: DetectedActivity | undefined;
private lastActivityTime: number | undefined;
private lastActivityType: string | undefined;
private totalEventsDetected = 0;

constructor(
/** Parent of all workspace hash dirs, e.g. ...User/workspaceStorage/ */
private readonly storageRoot: string | undefined,
private readonly onMood: (payload: PetMoodPayload) => void,
private readonly output?: vscode.OutputChannel
) {
this.log(`Created. storageRoot=${storageRoot ?? '(undefined)'}`);
if (this.storageRoot) {
this.start();
} else {
this.log('warning storageRoot is undefined - chat log watching inactive. Is the workspace saved?');
}
}

public getStatus(): ChatLogStatus {
return {
enabled: true,
storageRoot: this.storageRoot,
watchedPaths: [...this.watchedPaths],
lazyWatching: this.lazyWatchers.length > 0,
lastActivityTime: this.lastActivityTime,
lastActivityType: this.lastActivityType,
totalEventsDetected: this.totalEventsDetected
};
}

public dispose() {
this.log('Disposing all watchers.');
for (const w of [...this.watchers, ...this.lazyWatchers]) {
try { w.close(); } catch { /* best-effort */ }
}
this.watchers.length = 0;
this.lazyWatchers.length = 0;
for (const t of this.readTimers.values()) {
clearTimeout(t);
}
this.readTimers.clear();
if (this.debounceTimer) {
clearTimeout(this.debounceTimer);
}
}

// -- Logging helper -------------------------------------------------------

private log(msg: string) {
this.output?.appendLine(`[ChatLogWatcher] ${msg}`);
}

// -- Bootstrap ------------------------------------------------------------

private start() {
if (!this.storageRoot) { return; }
this.log(`Scanning workspace storage root: ${this.storageRoot}`);

let hashDirs: string[] = [];
try {
hashDirs = fs.readdirSync(this.storageRoot, { withFileTypes: true })
.filter(d => d.isDirectory())
.map(d => path.join(this.storageRoot!, d.name));
} catch (err) {
this.log(`  error: Failed to read storageRoot: ${String(err)}`);
return;
}
this.log(`  Found ${hashDirs.length} hash dir(s). Looking for chatSessions...`);

for (const hashDir of hashDirs) {
this.activateForHashDir(hashDir);
}

const active = this.watchedPaths.length;
if (active === 0) {
this.log('warning No chatSessions directories found in any hash dir. Copilot may not be active yet.');
this.log('  -> Starting lazy watch on storageRoot for new hash dirs.');
this.startLazyRootWatch();
} else {
this.log(`ok Watching ${active} chatSessions director${active === 1 ? 'y' : 'ies'}.`);
}
}

/** Try to watch chatSessions/ inside a given hash directory. */
private activateForHashDir(hashDir: string) {
for (const dirName of CHAT_SESSION_DIRS) {
const target = path.join(hashDir, dirName);
if (this.watchedPaths.includes(target)) { continue; }
const exists = fs.existsSync(target);
this.log(`  Checking ${target} -- ${exists ? 'EXISTS' : 'not found'}`);
if (!exists) { continue; }

try {
const watcher = fs.watch(target, (event, filename) => {
try {
const name = filename ? filename.toString() : '(null)';
this.log(`  event=${event} file=${name} in ${path.relative(this.storageRoot ?? '', target)}`);
if (!filename) { return; }
if (name.endsWith('.json') || name.endsWith('.jsonl')) {
this.scheduleRead(path.join(target, name));
} else {
this.log(`  Skipping non-JSON/JSONL: ${name}`);
}
} catch (e) {
this.log(`  Error in watcher callback: ${String(e)}`);
}
});
watcher.on('error', (err) => {
this.log(`  Watcher error on ${target}: ${String(err)}`);
});
this.watchers.push(watcher);
this.watchedPaths.push(target);
this.log(`  ok Watching: ${target}`);
this.scanExistingFiles(target);
} catch (err) {
this.log(`  error: Failed to watch ${target}: ${String(err)}`);
}
}

const hasAny = CHAT_SESSION_DIRS.some(d => this.watchedPaths.includes(path.join(hashDir, d)));
if (!hasAny) {
this.startLazyHashDirWatch(hashDir);
}
}

/** On startup, read the most recently modified file to catch mid-session state. */
private scanExistingFiles(dir: string) {
try {
const files = fs.readdirSync(dir)
.filter(f => f.endsWith('.json') || f.endsWith('.jsonl'))
.map(f => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
.sort((a, b) => b.mtime - a.mtime)
.slice(0, 1);
if (files.length > 0) {
this.log(`  Initial scan: reading most recent file: ${files[0].f}`);
this.scheduleRead(path.join(dir, files[0].f));
}
} catch {
// best-effort
}
}

/** Watch a hash dir for creation of chatSessions/ inside it. */
private startLazyHashDirWatch(hashDir: string) {
try {
const watcher = fs.watch(hashDir, (_event, filename) => {
if (!filename) { return; }
const lower = filename.toString().toLowerCase();
if (!CHAT_SESSION_DIRS.map(d => d.toLowerCase()).includes(lower)) { return; }
this.log(`  Lazy hash watcher: "${filename}" appeared in ${path.basename(hashDir)} -- activating.`);
const before = this.watchedPaths.length;
this.activateForHashDir(hashDir);
if (this.watchedPaths.length > before) {
try { watcher.close(); } catch { /* best-effort */ }
const idx = this.lazyWatchers.indexOf(watcher);
if (idx >= 0) { this.lazyWatchers.splice(idx, 1); }
}
});
watcher.on('error', () => { /* ignore */ });
this.lazyWatchers.push(watcher);
} catch {
// best-effort
}
}

/** Watch the storageRoot for brand-new hash directories. */
private startLazyRootWatch() {
if (!this.storageRoot) { return; }
try {
const watcher = fs.watch(this.storageRoot, (_event, filename) => {
if (!filename) { return; }
const newHashDir = path.join(this.storageRoot!, filename.toString());
try {
if (!fs.statSync(newHashDir).isDirectory()) { return; }
} catch { return; }
this.log(`  Lazy root watcher: new hash dir "${filename}" -- scanning.`);
this.activateForHashDir(newHashDir);
if (this.watchedPaths.length > 0) {
try { watcher.close(); } catch { /* best-effort */ }
const idx = this.lazyWatchers.indexOf(watcher);
if (idx >= 0) { this.lazyWatchers.splice(idx, 1); }
}
});
watcher.on('error', () => { /* ignore */ });
this.lazyWatchers.push(watcher);
this.log(`  Lazy root watcher started on: ${this.storageRoot}`);
} catch (err) {
this.log(`  error: Failed to start lazy root watcher: ${String(err)}`);
}
}

// -- File read scheduling -------------------------------------------------

private scheduleRead(filePath: string) {
this.log(`  scheduleRead: ${path.basename(filePath)}`);
const existing = this.readTimers.get(filePath);
if (existing) { clearTimeout(existing); }
this.readTimers.set(filePath, setTimeout(() => {
this.readTimers.delete(filePath);
void this.processFile(filePath);
}, 200));
}

private async processFile(filePath: string) {
const isJsonl = filePath.endsWith('.jsonl');
this.log(`  Reading (${isJsonl ? 'JSONL' : 'JSON'}): ${path.basename(filePath)}`);
try {
const content = await fs.promises.readFile(filePath, 'utf8');
this.log(`  Read ${content.length} bytes.`);
if (this.lastFileContent.get(filePath) === content) {
this.log(`  No change -- skipping.`);
return;
}
this.lastFileContent.set(filePath, content);

const activity = isJsonl
? this.analyzeJsonlSession(content)
: this.analyzeJsonSession(content, filePath);

if (activity) {
this.log(`  Activity: ${activity.type}${activity.toolName ? ` (tool=${activity.toolName})` : ''}`);
this.emitMood(activity);
} else {
this.log(`  No actionable activity found.`);
}
} catch (err) {
this.log(`  error: Failed to read ${path.basename(filePath)}: ${String(err)}`);
}
}

// -- JSONL differential session log parser --------------------------------

/**
 * VS Code Copilot Chat session files use a differential JSONL format.
 * Each line: { kind: 1|2, k: (string|number)[], v: unknown, i?: number }
 *   kind 1 = set, kind 2 = update
 *
 * When k contains "response", v is an array of response items:
 *   { kind: "toolInvocationSerialized", toolId: "copilot_readFile", ... }
 *   { kind: "thinking", value: "...", ... }
 *   { kind: "textEditGroup", ... }
 *   { kind: "progressMessage", ... }
 *
 * We scan the last 30 lines to detect the most recent activity.
 */
private analyzeJsonlSession(content: string): DetectedActivity | null {
const lines = content.split('\n').filter(l => l.trim());
this.log(`  JSONL: ${lines.length} lines. Analysing last 30.`);

const indicators: Indicators = { hasError: false, hasWarning: false, hasRecentResponse: false, hasEditing: false, isActive: false };
const recent = lines.slice(-30);

for (const line of recent) {
	try {
		const record = JSON.parse(line) as {
			kind?: number;
			k?: (string | number)[];
			v?: unknown;
			i?: number;
		};

		const k = record.k ?? [];

		// Only care about records that carry response content
		if (!k.includes('response')) { continue; }

		if (!Array.isArray(record.v)) { continue; }

		for (const item of record.v as Record<string, unknown>[]) {
			const itemKind = typeof item['kind'] === 'string' ? item['kind'] : '';
			const toolId = typeof item['toolId'] === 'string' ? item['toolId']
				: typeof item['tool'] === 'string' ? item['tool']
				: undefined;

			this.log(`    v item: kind=${itemKind}${toolId ? ` toolId=${toolId}` : ''}`);

			// --- Tool invocations ---
			if (itemKind === 'toolInvocationSerialized' && toolId) {
				indicators.lastToolName = toolId;
			}
			if (itemKind === 'prepareToolInvocation') {
				indicators.isActive = true;
			}

			// --- AI thinking / response ---
			if (itemKind === 'thinking') {
				const val = item['value'];
				if (typeof val === 'string' && val.length > 0) {
					indicators.hasRecentResponse = true;
				}
			}
			if (itemKind === 'text' || itemKind === 'agent' || itemKind === 'subagent') {
				indicators.hasRecentResponse = true;
			}

			// --- Code editing ---
			if (itemKind === 'textEditGroup' || itemKind === 'workspaceEdit') {
				indicators.hasEditing = true;
				if (!indicators.lastToolName) {
					indicators.lastToolName = 'copilot_replaceString';
				}
			}

			// --- Progress / active signals ---
			if (itemKind === 'progressMessage' || itemKind === 'progressTaskSerialized'
				|| itemKind === 'mcpServersStarting' || itemKind === 'steering') {
				indicators.isActive = true;
			}

			// --- User interaction ---
			if (itemKind === 'confirmation' || itemKind === 'elicitation'
				|| itemKind === 'elicitationSerialized' || itemKind === 'questionCarousel') {
				indicators.hasRecentResponse = true;
			}

			// --- Warnings / errors ---
			if (itemKind === 'warning') {
				indicators.hasWarning = true;
			}
			if (itemKind.includes('error') || itemKind.includes('fail')) {
				indicators.hasError = true;
			}

			// Skip purely structural kinds (codeblockUri, undoStop, inlineReference,
			// reference, promptFile, promptText, todoList, terminal, file, image,
			// input, tool, workspace) — they don't indicate a specific mood.
		}
	} catch {
		// skip malformed line
	}
}

if (lines.length > 0) { indicators.isActive = true; }
return this.indicatorsToActivity(indicators);
}

// -- Plain JSON parser (older Copilot format) -----------------------------

private analyzeJsonSession(content: string, filePath: string): DetectedActivity | null {
try {
const parsed = JSON.parse(content);
return this.indicatorsToActivity(this.extractIndicators(parsed));
} catch (parseErr) {
this.log(`  warning JSON parse failed for ${path.basename(filePath)}: ${String(parseErr)}`);
return null;
}
}

/** Recursively scan a JSON structure for tool-call / response / error indicators. */
private extractIndicators(data: unknown, depth = 0): Indicators {
const result: Indicators = { hasError: false, hasWarning: false, hasRecentResponse: false, hasEditing: false, isActive: false };
if (depth > 10 || !data) { return result; }

if (Array.isArray(data)) {
const recent = data.slice(-5);
for (const item of recent) {
this.mergeIndicators(result, this.extractIndicators(item, depth + 1));
}
if (data.length > 0) { result.isActive = true; }
} else if (typeof data === 'object' && data !== null) {
const obj = data as Record<string, unknown>;
const toolArray = obj['tool_calls'] ?? obj['toolCalls'] ?? obj['toolInvocations'];
if (Array.isArray(toolArray) && toolArray.length > 0) {
const last = toolArray[toolArray.length - 1] as Record<string, unknown> | undefined;
result.lastToolName = this.extractToolName(last) ?? 'unknown';
}
if (obj['error'] || obj['status'] === 'error' || obj['status'] === 'failed') {
result.hasError = true;
}
if (obj['role'] === 'assistant' || obj['responder']) {
result.hasRecentResponse = true;
}
for (const key of ['requests', 'history', 'messages', 'turns', 'entries', 'result', 'response', 'metadata', 'input', 'output']) {
if (obj[key]) {
this.mergeIndicators(result, this.extractIndicators(obj[key], depth + 1));
}
}
}
return result;
}

private mergeIndicators(target: Indicators, source: Indicators) {
if (source.hasError) { target.hasError = true; }
if (source.hasWarning) { target.hasWarning = true; }
if (source.lastToolName) { target.lastToolName = source.lastToolName; }
if (source.hasRecentResponse) { target.hasRecentResponse = true; }
if (source.hasEditing) { target.hasEditing = true; }
if (source.isActive) { target.isActive = true; }
}

private extractToolName(entry: Record<string, unknown> | undefined): string | undefined {
if (!entry) { return undefined; }
if (typeof entry['toolName'] === 'string') { return entry['toolName']; }
if (typeof entry['name'] === 'string') { return entry['name']; }
const fn = entry['function'];
if (fn && typeof fn === 'object' && typeof (fn as Record<string, unknown>)['name'] === 'string') {
return (fn as Record<string, unknown>)['name'] as string;
}
return undefined;
}

private indicatorsToActivity(indicators: Indicators): DetectedActivity | null {
if (indicators.hasError) {
	return { source: 'copilot', type: 'error', timestamp: Date.now() };
}
if (indicators.lastToolName) {
	return { source: 'copilot', type: 'tool_call', toolName: indicators.lastToolName, timestamp: Date.now() };
}
if (indicators.hasEditing) {
	return { source: 'copilot', type: 'editing', timestamp: Date.now() };
}
if (indicators.hasRecentResponse) {
	return { source: 'copilot', type: 'response', timestamp: Date.now() };
}
if (indicators.hasWarning) {
	return { source: 'copilot', type: 'working', timestamp: Date.now() };
}
if (indicators.isActive) {
	return { source: 'copilot', type: 'active', timestamp: Date.now() };
}
return null;
}

// -- Mood emission --------------------------------------------------------

private emitMood(activity: DetectedActivity) {
const now = Date.now();
if (now - this.lastEmitTime < EMIT_DEBOUNCE_MS) {
const remaining = EMIT_DEBOUNCE_MS - (now - this.lastEmitTime);
this.log(`  Debouncing ${remaining}ms. Queuing activity=${activity.type}.`);
if (!this.debounceTimer) {
this.pendingActivity = activity;
this.debounceTimer = setTimeout(() => {
this.debounceTimer = undefined;
if (this.pendingActivity) {
const pending = this.pendingActivity;
this.pendingActivity = undefined;
this.emitMood(pending);
}
}, remaining);
} else {
this.pendingActivity = activity;
}
return;
}
this.lastEmitTime = now;
this.lastActivityTime = now;
this.lastActivityType = `${activity.type}${activity.toolName ? `:${activity.toolName}` : ''}`;
this.totalEventsDetected++;
const payload = this.activityToMood(activity);
this.log(`robot Emitting: ${activity.type}${activity.toolName ? ` tool=${activity.toolName}` : ''} -> ${payload.mood} (total=${this.totalEventsDetected})`);
this.onMood(payload);
}

private activityToMood(activity: DetectedActivity): PetMoodPayload {
if (activity.type === 'error') {
	return { mood: 'error', durationSeconds: 5 };
}
if (activity.type === 'tool_call' && activity.toolName) {
	return { mood: this.mapToolToAction(activity.toolName), durationSeconds: 4 };
}
if (activity.type === 'editing') {
	return { mood: 'coding', durationSeconds: 4 };
}
if (activity.type === 'response') {
	return { mood: 'thinking', durationSeconds: 3 };
}
if (activity.type === 'working') {
	return { mood: 'lookaround', durationSeconds: 3 };
}
// 'active' — generic heartbeat
return { mood: 'idle', durationSeconds: 3 };
}

/**
 * Map a Copilot / MCP toolId to a robot PetAction.
 *
 * Complete list sourced from scanning 84 JSONL + 150 JSON session files:
 *
 * ── File editing ─────────────────────────────────────────
 * copilot_applyPatch, copilot_createFile, copilot_multiReplaceString,
 * copilot_replaceString
 *
 * ── File reading / listing ───────────────────────────────
 * copilot_readFile, copilot_listDirectory, copilot_findFiles
 *
 * ── Search / code intelligence ───────────────────────────
 * copilot_findTextInFiles, copilot_searchCodebase, copilot_listCodeUsages
 *
 * ── Diagnostics ──────────────────────────────────────────
 * copilot_getErrors
 *
 * ── Terminal / tasks ─────────────────────────────────────
 * run_in_terminal, run_task, get_task_output, get_terminal_output,
 * await_terminal, kill_terminal
 *
 * ── User interaction / questions ─────────────────────────
 * copilot_askQuestions
 *
 * ── Project / workspace ─────────────────────────────────
 * copilot_getProjectSetupInfo, copilot_getVSCodeAPI,
 * copilot_runVscodeCommand, copilot_createNewWorkspace,
 * copilot_createDirectory
 *
 * ── Web / browser ────────────────────────────────────────
 * copilot_fetchWebPage, copilot_openSimpleBrowser,
 * vscode_fetchWebPage_internal
 *
 * ── Git / source control ─────────────────────────────────
 * copilot_getChangedFiles, copilot_githubRepo
 *
 * ── Agent management ─────────────────────────────────────
 * manage_todo_list, runSubagent, search_subagent
 *
 * ── MCP tools ────────────────────────────────────────────
 * Any tool prefixed with mcp_* — mapped generically by keyword
 *
 * ── Rendering ────────────────────────────────────────────
 * renderMermaidDiagram
 */
private mapToolToAction(toolId: string): PetAction {
	const id = toolId.toLowerCase();

	// ── Copilot built-in: file editing → coding ──
	if (id === 'copilot_replacestring'
		|| id === 'copilot_multireplacestring'
		|| id === 'copilot_applypatch'
		|| id === 'copilot_createfile'
		|| id === 'copilot_createdirectory'
		|| id === 'copilot_createnewworkspace') {
		return 'coding';
	}

	// ── Copilot built-in: file reading / listing → reading ──
	if (id === 'copilot_readfile'
		|| id === 'copilot_listdirectory'
		|| id === 'copilot_findfiles') {
		return 'reading';
	}

	// ── Copilot built-in: search / code intelligence → inspect ──
	if (id === 'copilot_findtextinfiles'
		|| id === 'copilot_searchcodebase'
		|| id === 'copilot_listcodeusages') {
		return 'inspect';
	}

	// ── Copilot built-in: diagnostics → debugging ──
	if (id === 'copilot_geterrors') {
		return 'debugging';
	}

	// ── Terminal / task execution → testing ──
	if (id === 'run_in_terminal'
		|| id === 'run_task'
		|| id === 'get_task_output'
		|| id === 'get_terminal_output'
		|| id === 'await_terminal'
		|| id === 'kill_terminal') {
		return 'testing';
	}

	// ── User interaction / questions → thinking ──
	if (id === 'copilot_askquestions') {
		return 'thinking';
	}

	// ── Web browsing → reading ──
	if (id === 'copilot_fetchwebpage'
		|| id === 'copilot_opensimplebrowser'
		|| id === 'vscode_fetchwebpage_internal') {
		return 'reading';
	}

	// ── Git / source control → reviewing ──
	if (id === 'copilot_getchangedfiles'
		|| id === 'copilot_githubrepo') {
		return 'reviewing';
	}

	// ── VS Code API / project setup → inspect ──
	if (id === 'copilot_getvscodeapi'
		|| id === 'copilot_getprojectsetupinfo'
		|| id === 'copilot_runvscodecommand') {
		return 'inspect';
	}

	// ── Agent sub-tasks → thinking ──
	if (id === 'manage_todo_list'
		|| id === 'runsubagent'
		|| id === 'search_subagent') {
		return 'thinking';
	}

	// ── Rendering / diagrams → reading ──
	if (id === 'rendermermaiddiagram') {
		return 'reading';
	}

	// ── MCP tools — infer from name segments ──
	if (id.startsWith('mcp_')) {
		if (id.includes('edit') || id.includes('write') || id.includes('create') || id.includes('patch') || id.includes('replace')) {
			return 'coding';
		}
		if (id.includes('read') || id.includes('list') || id.includes('fetch') || id.includes('browse') || id.includes('open')) {
			return 'reading';
		}
		if (id.includes('search') || id.includes('find') || id.includes('grep') || id.includes('usage')) {
			return 'inspect';
		}
		if (id.includes('debug') || id.includes('fix') || id.includes('diagnos') || id.includes('error') || id.includes('lint')) {
			return 'debugging';
		}
		if (id.includes('test') || id.includes('run') || id.includes('exec') || id.includes('terminal') || id.includes('task')) {
			return 'testing';
		}
		if (id.includes('review') || id.includes('diff') || id.includes('compare') || id.includes('git') || id.includes('change')) {
			return 'reviewing';
		}
		if (id.includes('refactor') || id.includes('rename') || id.includes('move') || id.includes('tidy')) {
			return 'refactoring';
		}
		// Default for unrecognised MCP tools
		return 'thinking';
	}

	// ── Generic keyword fallbacks for unknown / future tools ──
	if (id.includes('edit') || id.includes('write') || id.includes('create')
		|| id.includes('insert') || id.includes('replace') || id.includes('patch')) {
		return 'coding';
	}
	if (id.includes('search') || id.includes('find') || id.includes('grep') || id.includes('usage')) {
		return 'inspect';
	}
	if (id.includes('read') || id.includes('list') || id.includes('fetch') || id.includes('browse') || id.includes('open')) {
		return 'reading';
	}
	if (id.includes('debug') || id.includes('fix') || id.includes('diagnos') || id.includes('error') || id.includes('lint')) {
		return 'debugging';
	}
	if (id.includes('test') || id.includes('run') || id.includes('exec') || id.includes('terminal') || id.includes('task')) {
		return 'testing';
	}
	if (id.includes('review') || id.includes('diff') || id.includes('compare') || id.includes('git') || id.includes('change')) {
		return 'reviewing';
	}
	if (id.includes('refactor') || id.includes('rename') || id.includes('move') || id.includes('tidy')) {
		return 'refactoring';
	}
	return 'thinking';
}
}
