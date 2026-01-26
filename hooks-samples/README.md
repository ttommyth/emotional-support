User-level Cursor hook sample

This repository includes a user-level hook sample at `hooks-samples/user-emotional-support-hook.js`.

Why use a user-level hook?
- Project hooks (`.cursor/hooks.json`) are stored inside the project and may be accidentally committed.
- User hooks live in your home directory (`~/.cursor/hooks.json`) and are safe to configure for your environment.

How to install the sample (recommended):
1. Copy the sample to your user hooks folder (do NOT commit into the project):

   On macOS / Linux:
   ```bash
   mkdir -p ~/.cursor/hooks
   cp hooks-samples/user-emotional-support-hook.js ~/.cursor/hooks/emotional-support-hook.js
   chmod +x ~/.cursor/hooks/emotional-support-hook.js
   ```

   On Windows (PowerShell):
   ```powershell
   New-Item -ItemType Directory -Force -Path $env:USERPROFILE\.cursor\hooks
   Copy-Item hooks-samples\user-emotional-support-hook.js $env:USERPROFILE\.cursor\hooks\emotional-support-hook.js -Force
   ```

2. Configure your `~/.cursor/hooks.json` to reference the script for relevant hook events:

   Example `~/.cursor/hooks.json`:
   ```json
   {
     "version": 1,
     "hooks": {
       "beforeReadFile": [{ "command": "./hooks/emotional-support-hook.js" }],
       "afterFileEdit": [{ "command": "./hooks/emotional-support-hook.js" }],
       "afterAgentThought": [{ "command": "./hooks/emotional-support-hook.js" }],
       "postToolUseFailure": [{ "command": "./hooks/emotional-support-hook.js" }],
       "afterAgentResponse": [{ "command": "./hooks/emotional-support-hook.js" }]
     }
   }
   ```

3. Point the hook to the extension's global event directory (recommended):
- When the extension runs it writes the global event path to the extension Output channel. Copy that path.
- Set the environment variable `EMOTIONAL_SUPPORT_EVENT_DIR` for your hook process so it writes events to the extension's watched directory.

  Example (bash):
  ```bash
  export EMOTIONAL_SUPPORT_EVENT_DIR="/path/to/extension/global/storage/cursor-events"
  ```

  Example (PowerShell):
  ```powershell
  $env:EMOTIONAL_SUPPORT_EVENT_DIR = 'C:\path\to\extension\global\storage\cursor-events'
  ```

4. Restart Cursor.

Notes:
- If `EMOTIONAL_SUPPORT_EVENT_DIR` is not set, the sample writes to `~/.cursor/emotional-support-events` as a fallback (keeps everything out of project folders).
- The hook returns `permission: "allow"` for `beforeReadFile` events to avoid blocking reads; modify if you need stricter control.
- You can customize `HOOK_TO_MOOD` inside the sample to change which mood maps to which hook event.
