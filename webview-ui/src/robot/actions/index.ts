import type { RobotActionMap } from '../types';
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
	knocked
};

export const codingActions = [
	'coding',
	'debugging',
	'reviewing',
	'refactoring',
	'testing',
	'thinking',
	'reading',
	'success',
	'error'
] as const;

export const idleFillerActions = ['idle', 'stretch', 'dance', 'lookaround', 'shrug', 'wave', 'sleep'] as const;
