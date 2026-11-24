// KILL880: replay a line's keys (--keys) at --seam; print each tick a spinner body or chaser leaves its roster, and the
// player's position there.
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
const { source, ...tape } = restoreRequest({ ...c0, staging: { ...c0.staging, seam: { ...c0.staging.seam, time: seam } } });
const run = JR.replayTape({ staging: tape.staging, perTick: [], levelSource: levelSourceFromAtlas(source.records), scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
const keys = JSON.parse(readFileSync(arg('keys'), 'utf8')).map((k) => new Set(k));
const ids = () => new Set([...(run.entities('spinnerBodies') ?? []).map((s) => s.id), ...(run.entities('chasers') ?? []).filter((c) => !c.removed && !c.destroy).map((c) => c.id)]);
let was = ids();
for (let t = 0; t < keys.length; t += 1) {
    run.advance(keys[t]);
    const now = ids();
    for (const id of was) if (!now.has(id)) console.log(`t${t + 1} gone ${id} P(${run.state.x.toFixed(1)},${run.state.y.toFixed(1)})`);
    was = now;
}
