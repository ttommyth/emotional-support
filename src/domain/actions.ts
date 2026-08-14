/**
 * Canonical domain vocabulary — the single source of truth for robot actions,
 * scene prop types, and named ground positions.
 *
 * Mirrored in the webview at `webview-ui/src/robot/types.ts`
 * (RobotActionName / ScenePropType); the consistency guard in
 * `src/test/action-consistency.test.ts` fails if the two drift.
 */

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

export const isPetAction = (value: string): value is PetAction => PET_ACTIONS.includes(value as PetAction);

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
