// KILL880: one dashless solve of 19:1 at --seam (after --wait idle ticks); prints the plan's own records (each goal's
// strategy rows, the kill's ticks) so two lines can be compared rung by rung.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
const R = process.env.REPO || process.cwd();
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const { restoreRequest } = await import(join(R, 'scripts/procgen/seedlingSolveRequestCodec.js'));
const { levelSourceFromAtlas } = await M('atlasSource.js');
const JR = await M('jsRuntimeSolver.js');
const cap = JSON.parse(gunzipSync(readFileSync(arg('req'))).toString('utf8'));
const c0 = cap.request;
const seam = arg('seam') === null ? c0.staging.seam.time : Number(arg('seam'));
const { source, budgetWork, upgradeWindowWork, passes, ...tape } = restoreRequest({ ...c0, staging: { ...c0.staging, seam: { ...c0.staging.seam, time: seam } } });
const levelSource = levelSourceFromAtlas(source.records);
const plan = JR.solveFromTape({ ...tape, levelSource, dashMode: 'none', shouldStop: () => false, fineCheckpoints: true });
console.log(Object.keys(plan).join(','));
const strip = (o, d = 0) => JSON.stringify(o, (k, v) => (Array.isArray(v) && v.length > 12 ? `[${v.length} items]` : v)).slice(0, 1500);
for (const r of plan.records ?? []) console.log('REC', strip(r));
