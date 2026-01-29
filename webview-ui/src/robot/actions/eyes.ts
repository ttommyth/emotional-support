import type { RobotEyeColorName } from '../types';

type EyeColors = {
	eyeCyan: number;
	eyeRed: number;
	eyeGreen: number;
	eyeOff: number;
	eyePurple: number;
	eyeCalm: number;
};

const eyeColorMap: Record<RobotEyeColorName, keyof EyeColors> = {
	cyan: 'eyeCyan',
	red: 'eyeRed',
	green: 'eyeGreen',
	off: 'eyeOff',
	purple: 'eyePurple',
	calm: 'eyeCalm'
};

export function getEyeColor(colors: EyeColors, desired?: RobotEyeColorName) {
	const key = desired ? eyeColorMap[desired] : 'eyeCyan';
	return colors[key];
}
