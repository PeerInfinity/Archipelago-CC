// node probe.mjs <capture> [variant] — replay.mjs plus SPEAR_ARM counts
import { readFileSync } from 'node:fs';
const WT = process.env.WT || '/home/user/Archipelago-CC';
const { restoreRequest } = await import(`${WT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${WT}/frontend/modules/seedlingDemo/atlasSource.js`);
const { solveAnytime, ANYTIME_PASSES } = await import(`${WT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const SA = await import(`${WT}/frontend/modules/seedlingDemo/spearArm.js`);
const [file, variant = 'as-captured'] = process.argv.slice(2);
const cap = JSON.parse(readFileSync(file, 'utf8'));
const req = restoreRequest(cap.request ?? cap);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
(await import('./variants.mjs')).default[variant](tape);
const a = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
console.log(JSON.stringify({ ok: a.ok, work: a.work, ticks: a.plan?.solution?.length, verbs: a.plan?.verbs, counts: SA.SPEAR_ARM_COUNTS,
  passes: (a.passes ?? []).map(({ ms, ...r }) => r), msg: a.ok ? null : String(a.message).slice(0, 3000) }, null, 1));
