export const PET_ACTIONS = [
	'idle',
	'thinking',
	'coding',
	'debugging',
	'reviewing',
	'refactoring',
	'testing',
	'reading',
	'inspect',
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
	'knocked',
	'tidyup',
	'stroll',
	'tripped'
] as const;

export type PetAction = (typeof PET_ACTIONS)[number];

export const SCENE_PROP_TYPES = [
	'paper',
	'laptop',
	'magnifying_glass',
	'clipboard',
	'wrench',
	'test_tubes',
	'lightbulb',
	'book',
	'coffee_mug',
	'star',
	'trophy'
] as const;

export type ScenePropType = (typeof SCENE_PROP_TYPES)[number];

export const SCENE_POSITIONS = ['far-left', 'left', 'center-left', 'center', 'center-right', 'right', 'far-right', 'back-left', 'back', 'back-right', 'front', 'front-left', 'front-right'] as const;

export type ScenePosition = (typeof SCENE_POSITIONS)[number];

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
