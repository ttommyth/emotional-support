# Add a Cursor Hook Event

Extend the Cursor Hook Bridge to handle new hook event types that trigger robot reactions.

## Architecture

```
Cursor Hook fires → runs hooks-samples/user-emotional-support-hook.js
  → writes emotional-support-event.json
  → CursorHookBridge (fs.watch) reads file
  → forwards PetMoodPayload to PetMoodService
  → extension sends SET_MOOD to webview
```

## Event File Format

The bridge watches for `emotional-support-event.json` with this shape:

```json
{
  "id": "unique-uuid",
  "mood": "coding",
  "message": "Optional description",
  "durationSeconds": 3,
  "hookEventName": "afterFileEdit",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

- `id` must be unique per event (prevents duplicate processing)
- `mood` must be a valid `PetAction` from `PET_ACTIONS`
- `durationSeconds` is optional (controls how long the action plays)

## Steps to Add a New Hook Event Mapping

### 1. Update the hook script (`hooks-samples/user-emotional-support-hook.js`)

Add the new event name to the `HOOK_TO_MOOD` mapping:

```js
const HOOK_TO_MOOD = {
  // ... existing mappings ...
  '<newHookEvent>': '<petAction>',
};
```

Existing mappings:
- `beforeReadFile` → `reading`
- `afterFileEdit` → `coding`
- `afterAgentThought` → `thinking`
- `beforeSubmitPrompt` → `thinking`
- `postToolUseFailure` → `error`
- `afterAgentResponse` → `success`

### 2. Customize the message in `makeMessage()`

Add a case to generate a descriptive message from the hook input:

```js
case '<newHookEvent>': {
  // Extract relevant info from input
  return `Description of what happened`;
}
```

### 3. Register the hook event in the install command

In `src/extension.ts`, the `emotional-support.installUserHook` command registers hook events. Add the new event name to the `events` array:

```ts
const events = [
  'beforeReadFile', 'afterFileEdit', 'afterAgentThought',
  'beforeSubmitPrompt', 'postToolUseFailure', 'afterAgentResponse',
  '<newHookEvent>'  // ← add here
];
```

## File Locations

| File | Purpose |
|---|---|
| `hooks-samples/user-emotional-support-hook.js` | The user-installable hook script |
| `hooks-samples/README.md` | Setup instructions for users |
| `src/cursor-hook-bridge.ts` | Watches and processes event files |
| `src/extension.ts` | Install command and bridge setup |

## Guidelines

- The hook script must be fast — it's invoked synchronously by Cursor
- Event files are written to `~/.cursor/emotional-support-events/` (global) or `.cursor/hooks/` (per-project)
- The `CursorHookBridge` debounces reads with a 60ms delay
- The `id` field deduplicates events — always generate a unique ID per invocation
- Keep the mood mappings intuitive (developer action → robot reaction)
