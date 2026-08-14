import { MathUtils } from 'three';
import type { Object3D, Vector3 } from 'three';

/**
 * Pure frame-lerp helpers used by the render loop.
 *
 * Extracted from the RobotScene render loop so they can be unit-tested in
 * isolation and reused by any consumer that needs smooth target-based
 * animation.
 */

/** Normalize a rotation angle difference to the -π..π range. */
export function normalizeRotation(rotDiff: number): number {
	while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
	while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
	return rotDiff;
}

/** Smoothly move `current` toward `target` by factor `f` (0..1). */
export function lerpV(current: Vector3, target: Vector3, f: number): Vector3 {
	return current.lerp(target, f);
}

/** Smoothly lerp an object's euler rotation toward `target` by factor `f`. */
export function lerpR(obj: Object3D, target: Vector3, f: number): void {
	obj.rotation.x = MathUtils.lerp(obj.rotation.x, target.x, f);
	obj.rotation.y = MathUtils.lerp(obj.rotation.y, target.y, f);
	obj.rotation.z = MathUtils.lerp(obj.rotation.z, target.z, f);
}

/** Angle lerp that takes the shortest path around the circle. */
export function lerpAngle(current: number, target: number, f: number): number {
	const diff = normalizeRotation(target - current);
	return current + diff * f;
}
