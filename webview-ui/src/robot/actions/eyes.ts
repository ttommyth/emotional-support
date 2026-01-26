import type { RobotActionName } from '../types';

type EyeColors = {
	eyeCyan: number;
	eyeRed: number;
	eyeGreen: number;
	eyeOff: number;
	eyePurple: number;
};

export function getEyeColor(action: RobotActionName, colors: EyeColors) {
	if (action === 'error') return colors.eyeRed;
	if (action === 'success') return colors.eyeGreen;
	if (action === 'sleep') return colors.eyeOff;
	if (action === 'knocked') return colors.eyePurple;
	return colors.eyeCyan;
}
