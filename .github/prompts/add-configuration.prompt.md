# Add a New Configuration Setting

Add a user-configurable setting under the `emotional-support.*` namespace.

## Three-file checklist

### 1. `package.json` — Declare the setting

Add to `contributes.configuration.properties`:

```json
"emotional-support.<settingName>": {
  "type": "<string|boolean|number|array>",
  "default": <defaultValue>,
  "description": "Clear description of what this setting controls."
}
```

Use appropriate JSON Schema validation (`pattern` for hex colors, `minimum`/`maximum` for numbers, `enum` for constrained strings, etc.).

### 2. `src/extension.ts` — Read in `PetViewProvider.getConfig()`

Add a line to read the setting:

```ts
public getConfig() {
  const config = vscode.workspace.getConfiguration('emotional-support');
  return {
    // ... existing settings ...
    myNewSetting: config.get<type>('myNewSetting', defaultValue),
  };
}
```

The config is automatically re-sent to the webview when any `emotional-support.*` setting changes, handled by the `onDidChangeConfiguration` listener.

### 3. `webview-ui/src/App.tsx` — Handle in `SET_CONFIG` handler

In the `SET_CONFIG` message case, read the new field from the config payload and apply it:

```ts
case 'SET_CONFIG': {
  // ... existing config handling ...
  if (data.myNewSetting !== undefined) {
    // Apply the setting (update materials, toggle features, etc.)
  }
  break;
}
```

## Setting Categories

| Category | Example settings | Notes |
|---|---|---|
| Colors | `accentColor`, `bodyColor`, `visorColor`, `limbColor` | Hex pattern `^#[0-9a-fA-F]{6}$` |
| Eye colors | `defaultEyeColor`, `successEyeColor`, `errorEyeColor` | Applied via `eyes.ts` |
| Behavior | `idleAnimations`, `reactToClicks` | Boolean toggles |
| Timing | `animationSpeed`, `movementSpeed`, `unfocusedSleepDelay` | Numeric with min/max |
| Filtering | `disabledActions` | Array with enum items |

## Guidelines

- Always provide a sensible default value
- Use descriptive `description` strings — they show in the Settings UI
- Color settings should include a hex example in the description
- Boolean settings that toggle major features should default to `true` (opt-out model)
- After adding the setting, verify it appears correctly in VS Code Settings (search "emotional-support")
