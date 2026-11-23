// FACE 1: the request's boot advanced with NO keys for --ticks ticks; every --every ticks prints the spinner bodies,
// the live chasers near the corner, and the player. Measures whether the bodies move without the player.
//   node idle.mjs --req=<file.json.gz> [--ticks=700] [--every=25]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
const R = process.env.REPO || process.cwd();
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const { restoreRequest } = await import(join(R, 'scripts/procgen/seedlingSolveRequestCodec.js'));
const { levelSourceFromAtlas } = await M('atlasSource.js');
const JR = await M('jsRuntimeSolver.js');
const cap = JSON.parse(gunzipSync(readFileSync(arg('req'))).toString('utf8'));
const { source, ...tape } = restoreRequest(cap.request);
const levelSource = levelSourceFromAtlas(source.records);
const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
const near = (b) => b.x > 640 && b.y > 680;
const NONE = new Set();
for (let t = 0; t <= Number(arg('ticks', 700)); t += 1) {
    if (t % Number(arg('every', 25)) === 0) {
        const sp = (run.entities('spinnerBodies') ?? []).filter(near).map((s) => `${s.id}@(${s.x.toFixed(1)},${s.y.toFixed(1)})${s.destroy ? 'X' : ''}`);
        const ch = (run.entities('chasers') ?? []).filter((c) => near(c) && !c.destroy && !c.removed).map((c) => `${c.id}@(${c.x.toFixed(1)},${c.y.toFixed(1)})`);
        console.log(`t${t} P(${run.state.x},${run.state.y}) ${sp.join(' ')} | ${ch.join(' ')}`);
    }
    run.advance(NONE);
}
