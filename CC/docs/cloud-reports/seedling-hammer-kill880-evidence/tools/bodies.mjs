// KILL880: replay a line's keys (--keys) at --seam (--from..--to ticks, every --every); the player and EVERY spinner
// body (position, removed/destroy flags, hammer angle if the run exposes one) and chaser, unfiltered.
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
const extra = Number(arg('idle', 0)); for (let i = 0; i < extra; i += 1) keys.push(new Set());
const from = Number(arg('from', 0)); const to = Number(arg('to', keys.length)); const every = Number(arg('every', 10));
if (process.argv.includes('--fields')) console.log(Object.keys((run.entities('spinnerBodies') ?? [])[0] ?? {}).join(','));
let hits = 0;
for (let t = 0; t <= Math.min(to, keys.length); t += 1) {
    if (t >= from && (t - from) % every === 0) {
        const sp = (run.entities('spinnerBodies') ?? []).map((s) => `${s.id}(${s.x.toFixed(1)},${s.y.toFixed(1)})${s.removed ? 'R' : ''}${s.destroy ? 'D' : ''}${s.health !== undefined ? `h${s.health}` : ''}`);
        console.log(`t${t} P(${run.state.x.toFixed(1)},${run.state.y.toFixed(1)}) k=[${[...(keys[t] ?? [])]}] ${sp.join(' ')}`);
    }
    if (t === keys.length) break;
    run.advance(keys[t]);
    const h = run.ledger('playerHits') ?? [];
    if (h.length > hits) { console.log(`HIT t${t + 1} ${JSON.stringify(h.at(-1)).slice(0, 200)}`); hits = h.length; }
}
