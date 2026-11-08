// MEASUREMENT ONLY (L53-KILLLOCK): a contact capture replayed on the model; prints when the tile (128..144,160..176)
// stops reading solid to `collidesSolid` (default opts) and the run's own `rocksBroken` rows (hit tick, goneAt).
// Usage: node rocks-broken.mjs <capture.json> [ticks=300]
import { readFileSync } from 'node:fs';
const ROOT = '/home/user/Archipelago-CC'; const M = ROOT + '/frontend/modules/seedlingDemo/';
const { untag } = await import(ROOT + '/scripts/procgen/replay-seedling-contact-capture.mjs');
const { createRunForStaging } = await import(M + 'tapeRunner.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const cap = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const req = untag(cap.request); const plan = untag(cap.plan);
const run = createRunForStaging(req.staging, levelSourceFromAtlas(untag(cap.records)), { scratchPersistence: req.scratchPersistence === true });
const keys = [...(req.perTick ?? []), ...plan.solution];
const box = { x: 130, y: 162, w: 12, h: 12, right: 142, bottom: 174 };
let prev = null;
for (let i = 0; i < Math.min(keys.length, Number(process.argv[3] ?? 300)); i += 1) {
    const hit = run.world.collidesSolid(box);
    const s = hit ? `${hit.tag ?? hit.cls}@${hit.x},${hit.y}` : 'none';
    const acts = (run.world.activators ?? []).filter((a) => /breakablerock/.test(a.id)).map((a) => a.id + (a.anim ? ':' + a.anim : '')).join(',');
    const k = `${s} | ${acts}`;
    if (k !== prev) { console.log(`t${i} solid-in-rock-tile: ${k}`); prev = k; }
    run.advance(keys[i]);
}
console.log(JSON.stringify(run.rocksBroken));
