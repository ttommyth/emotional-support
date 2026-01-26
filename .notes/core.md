This is a fantastic "AI-native" twist on the classic virtual pet concept. By connecting the pet to **Cursor/Kiro** hooks and **MCP**, you transform it from a passive decoration into a reactive "pair programmer" that visually reflects the AI's internal state (thinking, coding, debugging).

Here is the project blueprint to kickstart your **AI-Connected Pet Panel**.

### **1. Project Architecture**

We need a bridge between the **AI Agent** (running in Cursor/Kiro) and your **VS Code Webview** (where the pet lives).

* **Frontend (The Body):** A VS Code Webview using React + HTML5 Canvas to render sprites (GIFs or Spritesheets).
* **Backend (The Brain):** A Node.js process inside the extension that runs an **MCP Server**.
* **The Nervous System (Hooks):**
* **Cursor:** `~/.cursor/hooks.json` triggers CLI commands or API calls when the agent acts.
* **Kiro:** `.kiro/hooks/` agents that listen for file events or prompt submissions.



---

### **2. Tech Stack & Tools**

* **Extension Core:** TypeScript, VS Code Extension API.
* **UI/Animation:** React (for UI overlay), PixiJS or plain CSS Keyframes (for pet animation).
* **AI Protocol:** [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) SDK for TypeScript.
* **Communication:** `vscode-messenger` (optional, for easy Webview <-> Ext Host comms).

---

### **3. Implementation Roadmap**

#### **Phase 1: The Visual Pet (Webview)**

Create a standard VS Code extension with a Webview provider.

* **Goal:** A panel showing a pet that can switch animations (Idle, Thinking, Typing, Happy, Confused).
* **Key Code:** A `PetController` in React that listens for messages.
```typescript
// webview/App.tsx
window.addEventListener('message', event => {
  const message = event.data;
  if (message.command === 'SET_MOOD') {
    setPetState(message.mood); // e.g., 'coding', 'thinking'
  }
});

```



#### **Phase 2: Built-in MCP Server (The AI Connection)**

Instead of just reacting to random clicks, we make the pet an **MCP Tool** that the AI can control.

* **How it works:** The extension spins up a local MCP server.
* **Tools Exposed:** `set_pet_reaction`, `announce_task_start`, `celebrate_success`.
* **Why:** When the AI (Claude/GPT) decides it has fixed a bug, it can *choose* to call `celebrate_success`, making the pet do a backflip.

**`src/mcp-server.ts` (Simplified)**

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// 1. Setup minimal MCP Server
const server = new Server({ name: "pet-panel", version: "1.0.0" }, { capabilities: { tools: {} } });

// 2. Define Tools the AI can use
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "set_pet_mood",
    description: "Change the visible pet's reaction. Use this when you start a task, encounter an error, or finish successfully.",
    inputSchema: {
      type: "object",
      properties: {
        mood: { type: "string", enum: ["thinking", "coding", "celebrating", "sleeping", "alert"] },
        message: { type: "string", description: "A short text bubble for the pet" }
      },
      required: ["mood"]
    }
  }]
}));

// 3. Handle Tool Calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "set_pet_mood") {
    // Send message to VS Code Webview to update UI
    PetPanel.currentPanel.postMessage({ command: 'SET_MOOD', ...request.params.arguments });
    return { content: [{ type: "text", text: "Pet mood updated!" }] };
  }
});

```

#### **Phase 3: Connecting the Hooks (The "Kiro/Cursor" Link)**

Since the AI might not *always* consciously call the tool, we use hooks to force reactions based on IDE events.

**A. Cursor Hooks (`.cursor/hooks.json`)**
Cursor allows running scripts before/after events. We can trigger the pet state from here.

* **File:** `.cursor/hooks.json`
* **Logic:**
* `beforeSubmitPrompt` → Trigger "Thinking" animation.
* `afterFileEdit` → Trigger "Typing" animation.
* `stop` (Agent finished) → Trigger "Idle" or "Happy".



```json
{
    "version": 1,
    "hooks": {
        "beforeSubmitPrompt": [
            { "command": "curl -X POST http://localhost:PORT/pet/mood -d '{\"mood\": \"thinking\"}'" }
        ],
        "afterFileEdit": [
            { "command": "curl -X POST http://localhost:PORT/pet/mood -d '{\"mood\": \"coding\"}'" }
        ]
    }
}

```

*(Note: Since you can't easily run a `vscode` command from a hook shell script, your extension should spin up a tiny lightweight HTTP server (express/fastify) on localhost to receive these hook signals.)*

**B. Kiro Hooks (`.kiro/hooks/`)**
Kiro uses a more "agentic" hook approach where you define triggers in natural language or JSON.

* **Example Hook:** "When a file is saved, tell the pet to look at the file."
* **Config:**
```json
{
  "name": "Pet Reaction Hook",
  "when": { "type": "fileSaved" },
  "then": {
    "type": "askAgent",
    "prompt": "Call the 'set_pet_mood' tool with mood='celebrating' if the code looks bug-free."
  }
}

```



---

### **4. Visual alignment logic**

To make the pet feel "alive" and aligned with the AI:

| AI Agent State | Hook Trigger | Pet Animation |
| --- | --- | --- |
| **Reading Context** | `beforeReadFile` (Cursor) | **Scanning/Reading** (Pet puts on glasses) |
| **Generating Code** | `afterFileEdit` | **Fast Typing** (Pet smashes keyboard) |
| **Thinking/Planning** | `beforeSubmitPrompt` | **Pacing/Scratching Head** |
| **Error/Failed Task** | Log stderr/Output | **Panicked/Fire extinguishing** |
| **Idle** | No events for 30s | **Sleeping/Eating** |

---
