export type PetMood = 'idle' | 'thinking' | 'coding' | 'reading' | 'success' | 'error' | 'sleep';

export type PetMoodPayload = {
	mood: PetMood;
	message?: string;
};

export class PetMcpServer {
	private readonly onMoodChange: (payload: PetMoodPayload) => void;
	private running = false;

	constructor(onMoodChange: (payload: PetMoodPayload) => void) {
		this.onMoodChange = onMoodChange;
	}

	public start() {
		if (this.running) {
			return;
		}
		this.running = true;
		// Placeholder for MCP server start. Wire up @modelcontextprotocol/sdk here.
		console.log('[PetMcpServer] Started (stub).');
	}

	public stop() {
		if (!this.running) {
			return;
		}
		this.running = false;
		console.log('[PetMcpServer] Stopped (stub).');
	}

	public dispose() {
		this.stop();
	}

	public setPetMood(payload: PetMoodPayload) {
		this.onMoodChange(payload);
	}
}
