# Add a New Webview Message

Add a new message type for communication between the extension host and the webview. Messages flow in two directions via `postMessage` / `onDidReceiveMessage`.

## Existing Message Table

| Direction | command | Key fields |
|---|---|---|
| ext → web | `SET_MOOD` | `mood`, `message?`, `durationSeconds?` |
| ext → web | `SET_AUTOPILOT` | `enabled: boolean` |
| ext → web | `FORCE_MOVE` | `target: 'front' \| 'left' \| 'right'` |
| ext → web | `SET_CONFIG` | All config fields from settings |
| web → ext | `READY` | (none) |
| web → ext | `SET_MOOD` | `mood`, `message` |

## Steps for Extension → Webview Message

### 1. Define the message shape

Choose a unique `command` string (UPPER_SNAKE_CASE convention). Document the payload fields.

### 2. Add sender method in `PetViewProvider` (`src/extension.ts`)

```ts
public sendMyMessage(data: MyPayload) {
  this.view?.webview.postMessage({ command: 'MY_MESSAGE', ...data });
}
```

### 3. Handle in webview (`webview-ui/src/App.tsx`)

In the `window.addEventListener('message', ...)` handler, add a case:

```ts
case 'MY_MESSAGE': {
  // Process data.payload fields
  break;
}
```

### 4. If triggered from MCP, update the bridge

Add the method to `RobotControlTarget` interface in `src/mcp-bridge.ts` and wire it in `processCommandFile()`.

## Steps for Webview → Extension Message

### 1. Send from webview (`webview-ui/src/App.tsx`)

```ts
vscode.postMessage({ command: 'MY_EVENT', /* fields */ });
```

### 2. Handle in extension (`src/extension.ts`)

In `PetViewProvider.resolveWebviewView()`, add a case to the `onDidReceiveMessage` handler:

```ts
case 'MY_EVENT': {
  // Validate fields, perform extension-side logic
  break;
}
```

## Guidelines

- Always validate incoming message fields before using them (check types with `typeof`)
- Use `isPetAction()` guard when receiving action names from the webview
- Messages are JSON-serializable only — no functions, classes, or circular references
- Keep message payloads minimal; avoid sending large data
- Update the message table in this file and in `copilot-instructions.md` when adding messages
