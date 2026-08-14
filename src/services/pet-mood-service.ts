import type { PetAction } from '../domain/actions';

export type PetMoodPayload = {
	mood: PetAction;
	message?: string;
	durationSeconds?: number;
	/** Animation temperature 0–1. 0 = very calm, 0.5 = normal, 1 = hyper. Omit to keep current. */
	temperature?: number;
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
