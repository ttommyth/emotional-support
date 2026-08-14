import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { PET_ACTIONS, SCENE_PROP_TYPES } from '../domain/actions';

/**
 * Cross-build consistency guard.
 *
 * The extension host and webview are bundled separately and cannot share a
 * single source file, so the canonical vocabulary in `pet-mood-service.ts`
 * (extension) is manually mirrored in `webview-ui/src/robot/types.ts`
 * (RobotActionName / ScenePropType). This guard fails if the two drift.
 *
 * The webview types file is read as source text and its union members
 * extracted, so this requires no cross-project compilation.
 */

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const WEBVIEW_TYPES_PATH = path.join(REPO_ROOT, 'webview-ui', 'src', 'robot', 'types.ts');
const WEBVIEW_ACTION_LABELS_PATH = path.join(REPO_ROOT, 'webview-ui', 'src', 'robot', 'action-labels.ts');

function readWebviewSource(filePath: string): string {
	assert.ok(fs.existsSync(filePath), `webview source file not found at ${filePath}`);
	return fs.readFileSync(filePath, 'utf8');
}

/** Extract quoted string-literal members of a `type X = ...` union. */
function extractUnionMembers(source: string, typeName: string): string[] {
	const block = source.match(new RegExp(`export type ${typeName} =([\\s\\S]*?);`));
	assert.ok(block, `could not find \`export type ${typeName}\` in webview types`);
	const members = Array.from(block![1].matchAll(/'([a-z_]+)'/g), (m) => m[1]);
	assert.ok(members.length > 0, `no union members parsed for ${typeName}`);
	return members;
}

/** Extract the string members of a `const X = [...]` array literal. */
function extractArrayMembers(source: string, constName: string): string[] {
	const block = source.match(new RegExp(`const ${constName}[\\s\\S]*?=\\s*\\[([\\s\\S]*?)\\];`));
	assert.ok(block, `could not find \`const ${constName}\` array in webview source`);
	const members = Array.from(block![1].matchAll(/'([a-z_]+)'/g), (m) => m[1]);
	assert.ok(members.length > 0, `no members parsed for ${constName}`);
	return members;
}

suite('action vocabulary consistency (extension ↔ webview)', () => {
	test('RobotActionName mirrors PET_ACTIONS exactly (as a set)', () => {
		const webview = extractUnionMembers(readWebviewSource(WEBVIEW_TYPES_PATH), 'RobotActionName');
		assert.deepStrictEqual(
			[...webview].sort(),
			[...PET_ACTIONS].sort(),
			'RobotActionName (webview) must match PET_ACTIONS (extension). Update BOTH when adding an action.'
		);
	});

	test('ScenePropType mirrors SCENE_PROP_TYPES exactly (as a set)', () => {
		const webview = extractUnionMembers(readWebviewSource(WEBVIEW_TYPES_PATH), 'ScenePropType');
		assert.deepStrictEqual(
			[...webview].sort(),
			[...SCENE_PROP_TYPES].sort(),
			'ScenePropType (webview) must match SCENE_PROP_TYPES (extension).'
		);
	});
	test('ACTION_ORDER (webview control panel) covers every RobotActionName', () => {
		const order = extractArrayMembers(readWebviewSource(WEBVIEW_ACTION_LABELS_PATH), 'ACTION_ORDER');
		const webview = extractUnionMembers(readWebviewSource(WEBVIEW_TYPES_PATH), 'RobotActionName');
		assert.deepStrictEqual(
			[...order].sort(),
			[...webview].sort(),
			'ACTION_ORDER (action-labels.ts) must list every RobotActionName. Add new actions to ACTION_ORDER too.'
		);
	});});
