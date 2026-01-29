export const PET_ACTIONS = [
	'idle',
	'thinking',
	'coding',
	'debugging',
	'reviewing',
	'refactoring',
	'testing',
	'reading',
	'success',
	'error',
	'sleep',
	'sit',
	'laydown',
	'laydownflat',
	'rest',
	'running',
	'ballet',
	'walk',
	'wave',
	'stretch',
	'dance',
	'lookaround',
	'shrug',
	'peek',
	'knocked'
] as const;

export type PetAction = (typeof PET_ACTIONS)[number];

export type PetMoodPayload = {
	mood: PetAction;
	message?: string;
	durationSeconds?: number;
};

export class PetMoodService {
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
		console.log('[PetMoodService] Started.');
	}

	public stop() {
		if (!this.running) {
			return;
		}
		this.running = false;
		console.log('[PetMoodService] Stopped.');
	}

	public dispose() {
		this.stop();
	}

	public setPetMood(payload: PetMoodPayload) {
		this.onMoodChange(payload);
	}
}
