# Add a New Extension Command

Register a new VS Code command for the Emotional Support extension.

## Steps

### 1. Declare in `package.json`

Add to `contributes.commands` array:

```json
{
  "command": "emotional-support.<commandId>",
  "title": "Emotional Support: <Human Readable Title>"
}
```

All commands must be prefixed with `emotional-support.` to namespace them properly.

### 2. Register the handler in `src/extension.ts`

Inside `activate()`, register the command and push to subscriptions:

```ts
context.subscriptions.push(
  vscode.commands.registerCommand('emotional-support.<commandId>', async () => {
    // Check petViewProvider.isReady() if the command needs the webview
    if (!petViewProvider.isReady()) {
      vscode.window.showInformationMessage('Open the Emotional Support view first.');
      return;
    }
    // Command logic here
  })
);
```

### 3. Optional: Add an activation event

If the command should activate the extension on its own (not already covered by `onStartupFinished`), add to `activationEvents` in `package.json`:

```json
"onCommand:emotional-support.<commandId>"
```

### 4. Optional: Add a keybinding

Add to `contributes.keybindings` in `package.json`:

```json
{
  "command": "emotional-support.<commandId>",
  "key": "ctrl+shift+<key>",
  "when": "emotional-support.petViewVisible"
}
```

## Guidelines

- Always check `petViewProvider.isReady()` before sending messages to the webview
- Use `vscode.window.showQuickPick()` or `showInputBox()` for user-interactive commands
- Push all disposables to `context.subscriptions` for proper cleanup
- Prefix command titles with "Emotional Support:" so they're findable in the Command Palette
- Dev-only commands can be guarded with `when` clauses using the `emotional-support.isDev` context key
