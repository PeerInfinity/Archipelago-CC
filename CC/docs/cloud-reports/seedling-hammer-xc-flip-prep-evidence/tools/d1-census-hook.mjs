// SCRATCH (XF D1): `node --import <this> <script>` — one aggregate per pressEscape call (HAMMER_ESCAPE_TRACE): the
// level, whether its world holds a BeamTower Solid, how the call ended (searched or the early bound), appended at exit
// as one JSON line to $XF_CENSUS_OUT, tagged $XF_TAG.
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
const R = process.env.REPO ?? '/home/user/Archipelago-CC';
const sb = await import(join(R, 'frontend/modules/seedlingDemo/solverBot.js'));
const agg = new Map();
const towerOf = new WeakMap();
sb.HAMMER_ESCAPE_TRACE.sink = (r) => {
    const w = r.run.world;
    let tw = towerOf.get(w);
    if (tw === undefined) { tw = (w.solids ?? []).some((s) => s && s.beamTowerId); towerOf.set(w, tw); }
    const searched = r.searches.length > 0 && r.expansions > 0;
    const end = searched ? 'searched' : (r.claim === false ? `noclaim:${String(r.why).slice(0, 40)}` : `bound:${r.bound}`);
    const k = `${r.run.level}|${tw ? 'tower' : '-'}|${end}`;
    agg.set(k, (agg.get(k) ?? 0) + 1);
};
process.on('exit', (code) => {
    if (!process.env.XF_CENSUS_OUT) return;
    appendFileSync(process.env.XF_CENSUS_OUT, JSON.stringify({ tag: process.env.XF_TAG ?? null, code,
        calls: Object.fromEntries([...agg].sort()) }) + '\n');
});
