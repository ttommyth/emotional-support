/**
 * CLI entry for the headless sanity check. Bundled by scripts/verify-actions.mjs
 * and executed in Node. Prints a compact per-item summary plus the full JSON
 * report on stdout.
 */
import { runSanityCheck } from './sanity-check';

const report = runSanityCheck();

// Compact human-readable summary
const pad = (s: string, n: number) => s.padEnd(n);
console.log('=== ACTION SWEEP ===');
console.log(`${pad('action', 14)}${pad('apply', 8)}${pad('pre', 5)}${pad('post', 5)}${pad('upd', 5)} nan  ${pad('maxAbs', 8)}${pad('amp', 8)}${pad('eye', 7)}${pad('handGap L/R', 13)} flags`);
for (const a of report.actions) {
	const flags: string[] = [];
	if (a.applyError) flags.push(`apply:${a.applyError}`);
	if (a.updateError) flags.push(`update:${a.updateError}`);
	if (a.preError) flags.push(`pre:${a.preError}`);
	if (a.postError) flags.push(`post:${a.postError}`);
	if (a.nanCount > 0) flags.push(`nan:${a.nanCount}`);
	if (a.exceedsBounds) flags.push('OUT-OF-BOUNDS');
	if (a.dead) flags.push('DEAD');
	const gaps = a.handGaps ? `${a.handGaps.left.toFixed(2)}/${a.handGaps.right.toFixed(2)}` : '-';
	console.log(
		`${pad(a.name, 14)}${pad(a.applyError ? 'ERR' : 'ok', 8)}${pad(a.hasPre ? 'y' : '-', 5)}${pad(a.hasPost ? 'y' : '-', 5)}${pad(a.hasUpdate ? 'y' : '-', 5)}` +
			`${String(a.nanCount).padStart(4)}  ${pad(a.maxAbs.toFixed(3), 8)}${pad(a.amplitude.toFixed(3), 8)}${pad(a.eyeColor ?? '-', 7)}${pad(gaps, 13)} ${flags.join(', ') || '-'}`
	);
}
console.log('--- ACTION PROPS ---');
for (const p of report.props) {
	console.log(
		`${pad(p.name, 12)} nodes=${String(p.nodeCount).padStart(3)} meshes=${String(p.meshCount).padStart(2)} size=${p.size.toFixed(2).padStart(7)}` +
			` anchor=(${p.anchorPos.map((v) => v.toFixed(2)).join(', ')}) rot=(${p.anchorRot.map((v) => v.toFixed(2)).join(', ')})` +
			(p.buildError ? ` ERR: ${p.buildError}` : p.nanCount > 0 ? ` nan:${p.nanCount}` : '')
	);
}
console.log('--- SCENE PROPS ---');
for (const p of report.sceneProps) {
	console.log(
		`${pad(p.type, 18)} nodes=${String(p.nodeCount).padStart(3)} meshes=${String(p.meshCount).padStart(2)} size=${p.size.toFixed(2).padStart(7)}` +
			(p.buildError ? ` ERR: ${p.buildError}` : p.nanCount > 0 ? ` nan:${p.nanCount}` : '')
	);
}
console.log(`missingFromMap=${JSON.stringify(report.missingFromMap)} extraInMap=${JSON.stringify(report.extraInMap)}`);
console.log('=== FULL JSON ===');
console.log(JSON.stringify(report));
