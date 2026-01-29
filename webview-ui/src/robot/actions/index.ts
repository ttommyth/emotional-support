import type { RobotActionMap, RobotActionName, RobotActionTag } from '../types';
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
import { success } from './success';
import { thinking } from './thinking';
import { walk } from './walk';
import { wave } from './wave';
import { peek } from './peek';

export const robotActions: RobotActionMap = {
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
	walk,
	wave,
	stretch,
	dance,
	lookaround,
	shrug,
	knocked,
	peek
};

export function actionHasTag(action: RobotActionName, tag: RobotActionTag): boolean {
	return robotActions[action].tags?.includes(tag) ?? false;
}

export function getActionsByTag(tag: RobotActionTag): RobotActionName[] {
	return (Object.keys(robotActions) as RobotActionName[]).filter((name) => actionHasTag(name, tag));
}
