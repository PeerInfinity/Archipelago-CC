import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { withContactFidelity } = await M('contactFidelity.js');
const sb = await M('solverBot.js');
const { parseTape } = await M('tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await M('tapeRunner.js');
const { patchedMapDocument } = await M('seedlingSetPatches.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const W = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(W.tape))));
const src = levelSourceFromAtlas(patchedMapDocument(MAP));
const probes = [];
globalThis.__DBG_CORRIDOR_PROBE = (wps, walk, hit) => probes.push({ wps, walk, hit });
const off = withContactFidelity({ corridorBodyPricing: false }, () => sb.solveSegment({
    run: createRunForStaging(staging, src), goals: W.goals, name: 'fc', boot: staging.boot,
    forkRun: () => createRunForStaging(staging, src) }));
const clean = probes.find((p) => !p.hit);
console.log('probes', probes.length, 'clean wps', JSON.stringify(clean.wps));
globalThis.__DBG_CORRIDOR_PROBE = null;
withContactFidelity({ corridorBodyPricing: true }, () => {
    const run = createRunForStaging(staging, src);
    const walk = sb.previewWalk(run, clean.wps, 0, { strike: sb.strikePolicyFor(run) });
    const drv = createRunForStaging(staging, src);
    let firstPos = null; let firstHeld = null; let firstBody = null;
    for (let i = 0; i < Math.min(walk.samples.length, off.perTick.length); i += 1) {
        const s = walk.samples[i];
        if (firstPos === null && (Math.abs(s.x - drv.state.x) > 1e-9 || Math.abs(s.y - drv.state.y) > 1e-9)) firstPos = { i, prev: [s.x, s.y], drv: [drv.state.x, drv.state.y] };
        const h = [...off.perTick[i]].sort().join('+'); const ph = [...(s.held ?? [])].sort().join('+');
        if (firstHeld === null && h !== ph) firstHeld = { i, drive: h, preview: ph };
        drv.advance(off.perTick[i]);
        for (const b of s.corridorBodies ?? []) {
            const l = drv.wallFlyers.bodies.find((x) => x.id === b.id);
            if (firstBody === null && l && (l.x !== b.x || l.y !== b.y)) firstBody = { i, tick: s.tick, id: b.id, fc: [b.x, b.y], live: [l.x, l.y] };
        }
    }
    const c = walk.samples.find((s) => (s.corridorBodies ?? []).some((b) => b.hitsPlayer));
    console.log(JSON.stringify({ n: walk.samples.length, drive: off.perTick.length, truncated: walk.truncated?.kind ?? null, firstPos, firstHeld, firstBody,
        firstContact: c ? { tick: c.tick, ids: c.corridorBodies.filter((b) => b.hitsPlayer).map((b) => b.id) } : null }));
});
