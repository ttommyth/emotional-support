const fs = require('fs');
const path = require('path');
const os = require('os');

// Prefer an explicit path set by the user or the extension output
const EVENT_DIR = process.env.EMOTIONAL_SUPPORT_EVENT_DIR || process.env.EMOTIONAL_SUPPORT_EVENT_DIR_PATH ||
  // Portable fallback to a hidden folder in the user's home (won't touch project files)
  path.join(os.homedir(), '.cursor', 'emotional-support-events');

const EVENT_FILENAME = 'emotional-support-event.json';

const HOOK_TO_MOOD = {
  beforeReadFile: 'reading',
  afterFileEdit: 'coding',
  afterAgentThought: 'thinking',
  beforeSubmitPrompt: 'thinking',  // Planning/thinking before submitting prompt
  postToolUseFailure: 'error',
  afterAgentResponse: 'success'
};

// Normalized activity kind consumed by the extension's AgentActivity pipeline
// (src/services/agent-activity.ts). Kept in sync with HOOK_TO_MOOD.
const HOOK_TO_KIND = {
  beforeReadFile: 'reading',
  afterFileEdit: 'editing',
  afterAgentThought: 'thinking',
  beforeSubmitPrompt: 'thinking',
  postToolUseFailure: 'error',
  afterAgentResponse: 'done'
};

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    // Some hook runners may not close stdin; set a small timeout if nothing arrives
    setTimeout(() => resolve(data), 200);
  });
}

function safeWriteEvent(dir, payload) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, EVENT_FILENAME);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return true;
  } catch (err) {
    // best-effort - log to stderr so Cursor Hooks output shows the error
    try {
      console.error(`[emotional-support-hook] Failed to write event: ${String(err)}`);
    } catch {}
    return false;
  }
}

function makeMessage(eventName, input) {
  switch (eventName) {
    case 'beforeReadFile': {
      const filePath = typeof input?.file_path === 'string' ? input.file_path : '';
      const fileName = filePath ? path.basename(filePath) : 'file';
      return `Reading ${fileName}.`;
    }
    case 'afterFileEdit': {
      const filePath = typeof input?.file_path === 'string' ? input.file_path : '';
      const fileName = filePath ? path.basename(filePath) : 'file';
      return `Updated ${fileName}.`;
    }
    case 'afterAgentThought':
      return 'Thinking through the task.';
    case 'beforeSubmitPrompt':
      return 'Planning next steps.';
    case 'postToolUseFailure':
      return 'Ran into an error.';
    case 'afterAgentResponse':
      return 'Done.';
    default:
      return undefined;
  }
}

async function main() {
  const raw = await readStdin();
  let input = {};
  try {
    input = raw ? JSON.parse(raw) : {};
  } catch (err) {
    // ignore parse errors - continue with empty input
  }

  const eventName = typeof input?.hook_event_name === 'string' ? input.hook_event_name : '';
  const mood = HOOK_TO_MOOD[eventName];
  const kind = HOOK_TO_KIND[eventName];

  if (mood && kind) {
    const filePath = typeof input?.file_path === 'string' ? input.file_path : '';
    const toolName = typeof input?.tool_name === 'string' ? input.tool_name : '';
    const errorText = typeof input?.error_text === 'string' ? input.error_text : '';
    const detail = filePath ? path.basename(filePath) : (toolName || undefined);
    const payload = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind,
      mood,
      message: makeMessage(eventName, input),
      detail,
      file_path: filePath || undefined,
      tool_name: toolName || undefined,
      error_text: errorText || undefined,
      hookEventName: eventName,
      updatedAt: new Date().toISOString(),
      conversation_id: typeof input?.conversation_id === 'string' ? input.conversation_id : undefined,
      generation_id: typeof input?.generation_id === 'string' ? input.generation_id : undefined
    };

    safeWriteEvent(EVENT_DIR, payload);
  }

  // Hook contract: for `beforeReadFile` we must return permission decision
  // Always return 'allow' to act as a pure listener and not block reads
  if (eventName === 'beforeReadFile') {
    const output = { permission: 'allow' };
    process.stdout.write(JSON.stringify(output));
    return;
  }

  // For all other events, return empty JSON (non-blocking)
  process.stdout.write(JSON.stringify({}));
}

main().catch((err) => {
  try {
    console.error(`[emotional-support-hook] runtime error: ${String(err)}`);
  } catch {}
  // On any error, always return non-blocking response to ensure
  // the hook never blocks cursor operations
  process.stdout.write(JSON.stringify({ permission: 'allow' }));
});
