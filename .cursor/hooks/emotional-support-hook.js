const fs = require('fs');
const path = require('path');

const projectDir = process.env.CURSOR_PROJECT_DIR || process.cwd();
const eventFile = path.join(projectDir, '.cursor', 'hooks', 'emotional-support-event.json');

const HOOK_TO_MOOD = {
	beforeReadFile: 'reading',
	afterFileEdit: 'coding',
	afterAgentThought: 'thinking',
	beforeSubmitPrompt: 'thinking',  // Planning/thinking before submitting prompt
	postToolUseFailure: 'error',
	afterAgentResponse: 'success'
};

const readStdin = () =>
	new Promise((resolve) => {
		let data = '';
		process.stdin.setEncoding('utf8');
		process.stdin.on('data', (chunk) => {
			data += chunk;
		});
		process.stdin.on('end', () => resolve(data));
	});

const getMessage = (eventName, payload) => {
	switch (eventName) {
		case 'beforeReadFile': {
			const filePath = typeof payload?.file_path === 'string' ? payload.file_path : '';
			const fileName = filePath ? path.basename(filePath) : 'file';
			return `Reading ${fileName}.`;
		}
		case 'afterFileEdit': {
			const filePath = typeof payload?.file_path === 'string' ? payload.file_path : '';
			const fileName = filePath ? path.basename(filePath) : 'file';
			return `Updating ${fileName}.`;
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
};

const writeEvent = (eventName, input) => {
	const mood = HOOK_TO_MOOD[eventName];
	if (!mood) {
		return;
	}
	const eventPayload = {
		id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
		mood,
		message: getMessage(eventName, input),
		hookEventName: eventName,
		updatedAt: new Date().toISOString(),
		conversationId: typeof input?.conversation_id === 'string' ? input.conversation_id : undefined,
		generationId: typeof input?.generation_id === 'string' ? input.generation_id : undefined
	};
	fs.mkdirSync(path.dirname(eventFile), { recursive: true });
	fs.writeFileSync(eventFile, JSON.stringify(eventPayload, null, 2), 'utf8');
};

const writeOutput = (eventName) => {
	// Always return non-blocking responses for all hooks
	// For beforeReadFile, we must return permission: 'allow'
	// For all other events, return empty object (non-blocking)
	if (eventName === 'beforeReadFile') {
		process.stdout.write(JSON.stringify({ permission: 'allow' }));
		return;
	}
	// Return empty object for all other events to avoid blocking
	process.stdout.write(JSON.stringify({}));
};

const main = async () => {
	const raw = await readStdin();
	const input = raw ? JSON.parse(raw) : {};
	const eventName = typeof input?.hook_event_name === 'string' ? input.hook_event_name : '';
	writeEvent(eventName, input);
	writeOutput(eventName);
};

main().catch(() => {
	// On any error, always return non-blocking response
	// This ensures the hook never blocks cursor operations
	process.stdout.write(JSON.stringify({ permission: 'allow' }));
});
