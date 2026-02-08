import type { RobotActionDefinition, RobotActionMap, RobotActionName, RobotActionTag } from '../types';
import type { PropDefinition } from './helpers';
import { coding } from './coding';
import { debugging } from './debugging';
import { reviewing } from './reviewing';
import { refactoring } from './refactoring';
import { testing } from './testing';
import { error } from './error';
import { idle } from './idle';
import { stretch } from './stretch';
import { dance } from './dance';
import { lookaround } from './lookaround';
import { shrug } from './shrug';
import { knocked } from './knocked';
import { reading } from './reading';
import { sleep } from './sleep';
import { sit } from './sit';
import { laydown } from './laydown';
import { laydownflat } from './laydownflat';
import { rest } from './rest';
import { running } from './running';
import { ballet } from './ballet';
import { success } from './success';
import { thinking } from './thinking';
import { walk } from './walk';
import { wave } from './wave';
import { peek } from './peek';
import { tidyup } from './tidyup';
import { stroll } from './stroll';
import { tripped } from './tripped';

/** All action definitions (may carry an optional `prop` field from defineAction) */
type ActionWithProp = RobotActionDefinition & { prop?: PropDefinition };

const allActions: ActionWithProp[] = [
	idle,
	thinking,
	coding,
	debugging,
	reviewing,
	refactoring,
	testing,
	reading,
	success,
	error,
	sleep,
	sit,
	laydown,
	laydownflat,
	rest,
	running,
	ballet,
	walk,
	wave,
	stretch,
	dance,
	lookaround,
	shrug,
	knocked,
	peek,
	tidyup,
	stroll,
	tripped
];

/** Action map keyed by name — used by the animation loop */
export const robotActions: RobotActionMap = Object.fromEntries(
	allActions.map((a) => [a.name, a])
) as RobotActionMap;

/**
 * Auto-collected prop definitions from all actions that have a `prop` field.
 * Pass this to `createRobotProps()` so props are created dynamically.
 */
export const actionPropDefs: Map<string, PropDefinition> = new Map(
	allActions.filter((a) => a.prop != null).map((a) => [a.name, a.prop!])
);

export function actionHasTag(action: RobotActionName, tag: RobotActionTag): boolean {
	return robotActions[action].tags?.includes(tag) ?? false;
}

export function getActionsByTag(tag: RobotActionTag): RobotActionName[] {
	return (Object.keys(robotActions) as RobotActionName[]).filter((name) => actionHasTag(name, tag));
}
