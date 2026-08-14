import type { RobotActionName } from './types';

/**
 * Canonical display order for robot actions.
 *
 * Centralized here so the control panel (and anything else that lists robot
 * actions) shares one ordering source instead of duplicating it. Each name is
 * checked against the `RobotActionName` union at compile time, so a typo can't
 * silently slip in.
 */
export const ACTION_ORDER: RobotActionName[] = [
	'idle', 'thinking', 'coding', 'debugging', 'reviewing', 'refactoring',
	'testing', 'reading', 'inspect', 'success', 'error', 'sleep', 'sit', 'laydown',
	'laydownflat', 'rest', 'running', 'ballet', 'walk', 'wave', 'stretch',
	'dance', 'lookaround', 'shrug', 'peek', 'knocked', 'tidyup', 'stroll', 'tripped'
];

/**
 * Friendly display labels for action names that don't title-case nicely.
 * Unknown actions fall back to title-casing the raw name.
 */
export const ACTION_DISPLAY: Partial<Record<RobotActionName, string>> = {
	laydownflat: 'Lay Down Flat',
	lookaround: 'Look Around'
};
