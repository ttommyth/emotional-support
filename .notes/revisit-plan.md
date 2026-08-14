# 🚀 Revised Master Plan: Emotional Support Agent

## **Phase 1: Architectural Review & Data flow**

**Goal:** Establish a pipeline that turns "Workspace Data" into "Emotional Context" without clogging the UI.

### **1.1 Analysis of Workspace Signals**

Before coding, the agent must identify *exactly* which VS Code APIs provide the necessary "status" signals to feed the LLM.

* **Audit Target:** `vscode.languages.getDiagnostics` (Error counts/warnings).
* **Audit Target:** `vscode.window.onDidChangeActiveTextEditor` (Context switching frequency).
* **Audit Target:** `vscode.workspace.onDidChangeTextDocument` (Typing speed/furious deletion).
* **Audit Target:** Git Extension API (Checking for uncommitted changes or merge conflicts).

### **1.2 Clean UI Architecture**

* **Constraint:** The webview (Robot) must be "clean." It should not look like a website stuck in a sidebar.
* **Strategy:**
* **Transparent Backgrounds:** Ensure the Webview uses `var(--vscode-editor-background)` or `transparent` to blend seamlessly.
* **SVG-First Design:** The robot should be an SVG manipulated by CSS classes (e.g., `.robot.sad`, `.robot.celebrating`) rather than heavy image files. This ensures crisp scaling in any panel size.
* **Collapsible Chat:** The text interface should be hidden by default (only the Robot is visible). Clicking the robot expands the "Thought Bubble" or chat overlay.



---

## **Phase 2: Core Refactor (The Event Bus)**

**Goal:** Decouple the UI from the Logic using a strong Event Bus.

### **2.1 The "Vibe Check" Service**

Create a centralized service that aggregates workspace noise into a single "Vibe" object.

* **File:** `src/services/WorkspaceVibeService.ts`
* **Responsibility:**
* Debounce rapid events (don't notify the LLM on every keystroke).
* Maintain a "Stress Score" (0-100) based on error count and time since last save.
* **Output:** A structured JSON object to be sent to the LLM (e.g., `{ errors: 12, lastSave: '45m ago', gitState: 'conflicted' }`).



### **2.2 Configuration Schema (`package.json`)**

Define the settings immediately so all future features are built behind flags.

* **Key Settings:**
* `emotionalSupport.robot.personality`: (Dropdown: "Supportive", "Sarcastic", "Stoic").
* `emotionalSupport.triggers.highErrorThreshold`: (Number, default 10).
* `emotionalSupport.privacy.sendCodeSnippets`: (Boolean, default `false` - STRICTLY enforces if code content is sent to LLM vs just metadata).
* `emotionalSupport.appearance.minimalMode`: (Boolean, default `false` - hides chat, shows only status indicator/color).



---

## **Phase 3: Implementation & Extension**

### **3.1 LLM & Workspace Status Integration (The Brain)**

The LLM is no longer a generic chatbot; it is a **Workspace Status Interpreter**.

* **Logic Flow:**
1. **Trigger:** `WorkspaceVibeService` detects a spike in errors (Status Change).
2. **Prompt Construction:** The system generates a system prompt *dynamically* based on the status.
* *Template:* "You are a coding companion. The user has [X] errors. They haven't saved in [Y] minutes. Their Git status is [Z]. React to this situation based on the [Selected Personality]."


3. **Action:** The LLM returns a JSON response containing:
* `mood`: (Enum: `SAD`, `NEUTRAL`, `HAPPY`, `PANIC`) -> Directly updates the Robot UI.
* `message`: (String) -> Short, punchy text for the robot's speech bubble.


4. **Optimization:** Use "System Instructions" to force the LLM to be brief. The sidebar has limited width.



### **3.2 Clean Robot Webview (The Face)**

* **Visual Stack:** React (lightweight) or Vanilla JS with simple CSS animations.
* **"Clean" Layout Strategy:**
* **Top 80%:** The Robot Avatar (Centered, floating).
* *Idle State:* Slow breathing animation (CSS `transform: scale`).
* *Busy State:* Eyes scanning left/right.


* **Bottom 20%:** A translucent "Toast" area for messages.
* Messages fade away after 10 seconds to keep the interface clean.


* **Input:** No permanent input bar. A small "+" or "Talk" icon reveals the input only when needed.



---

## **Phase 4: Detailed Refactoring Tasks for Agents**

### **Task 1: Configuration & Manifest**

* **Action:** Open `package.json`.
* **Instruction:** Add the `contributes.configuration` block. Define `emotionalSupport.llm.provider` (initially just 'mock' or 'openai'), `emotionalSupport.triggers.*`, and `emotionalSupport.robot.style`.
* **Outcome:** Users can now see settings in the VS Code UI.

### **Task 2: The Workspace Watcher**

* **Action:** Create `src/watchers/DiagnosticWatcher.ts`.
* **Instruction:** Subscribe to `vscode.languages.onDidChangeDiagnostics`. Calculate the total number of "Error" severity items in the active workspace. Expose a `onStressLevelChange` event.
* **Constraint:** Ignore `node_modules` errors.

### **Task 3: The LLM Client Wrapper**

* **Action:** Create `src/ai/MoodInterpreter.ts`.
* **Instruction:** Implement a function `interpretWorkspaceState(state: WorkspaceState): Promise<RobotReaction>`.
* **Refinement:** Ensure this uses the `emotionalSupport.apiKey` setting. If the key is missing, fallback to a basic heuristic (e.g., "If errors > 0 return SAD").

### **Task 4: The Clean UI**

* **Action:** Rewrite `media/main.js` and `src/panels/RobotPanel.ts`.
* **Instruction:** Remove any existing buttons or tables. Implement a single `div.robot-container` that accepts classes like `.status-error`, `.status-success`. Ensure all colors use `var(--vscode-*)` theme variables so it looks native in Light and Dark mode.

---

## **Phase 5: Final Polish (Team & Optimization)**

* **Team "Vibe" (Optional):** If configured, allow the "Workspace Status" to be broadcast to a shared file (e.g., `.vscode/team-mood.json`) so the robot can comment on the *project's* health, not just the *user's* health.
* **Telemetry (Local):** Show a "Mood Graph" in the output channel—tracking how the user's coding session went over time (e.g., "You spent 40% of the time in High Stress").

---

## ✅ STATUS UPDATE — 2026-08-15

Most of this master plan is implemented, with deviations:

| Plan item | Status | Notes |
| --- | --- | --- |
| Phase 1 — workspace signal audit | ✅ Done | `services/workspace-vibe-service.ts` aggregates diagnostics, text edits, saves, editor switches, git state into a `WorkspaceVibe` (stressScore 0–100 + `vibeLevel` thresholds 15/35/55/75) |
| Phase 2 — Event Bus / Vibe Check | ✅ Done | `WorkspaceVibeService` debounces emits (15s), `VibeReactionController` (src/vibe-reactions.ts) drives reactions |
| Phase 2 — config schema | ✅ Done | `emotional-support.*` settings in `package.json` (personality, highErrorThreshold, colors, animation/movement speed, temperature, disabledActions, showThoughtBubbles, …) |
| Phase 3 — Workspace Status Interpreter | ✅ (heuristic) | `services/mood-interpreter.ts` `MoodInterpreter` — rule-based heuristics + 3 personalities; **no external LLM/API key** (deviation from original "LLM brain" idea) |
| Phase 3 — Clean Robot Webview | ✅ Done | Three.js robot + toasts/thought-bubbles, VS Code theme colors, minimal chrome |
| Phase 4 — Task 1 manifest | ✅ Done | `contributes.configuration` + views/commands/activationEvents |
| Phase 4 — Task 2 DiagnosticWatcher | ✅ Done | inside `workspace-vibe-service.ts` (`onDidChangeDiagnostics`, ignores node_modules) |
| Phase 4 — Task 3 LLM wrapper | ➡️ Replaced | `MoodInterpreter` is synchronous heuristic, not async LLM |
| Phase 4 — Task 4 clean UI | ✅ Done | `webview-ui/src/app/` + `control-panel/` |
| Phase 5 — team mood file | ⬜ Not built | (optional, deferred) |
| Phase 5 — mood graph in output | ✅ Done | `MoodHistoryService.printSummary()` (mood-history-service.ts) + `showSessionSummary`/`showVibeStatus` commands |

Extra shipped beyond this plan: **MCP server** (`mcp-server.ts`), **Cursor hook bridge** (`hooks/cursor-hook-bridge.ts`), **scene props** (place/pick-up/throw/tidy), **unfocused wind-down** (WindowFocusMonitor), **autopilot FSM**, and a **45-test suite**. See `docs/architecture-refactor.md` for the 2026-08-15 refactor.

---
