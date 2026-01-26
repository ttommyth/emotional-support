import type { RobotActionMap } from '../types';
import { coding } from './coding';
import { error } from './error';
import { idle } from './idle';
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
	reading,
	success,
	error,
	sleep,
	walk,
	wave,
	knocked
};
