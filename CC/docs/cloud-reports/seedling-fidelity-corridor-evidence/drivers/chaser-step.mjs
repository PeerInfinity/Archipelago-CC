// the clean probe's preview vs the OFF drive: positions, held, chaser bodies, and the danger map's verdict at the hit tick
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { withContactFidelity } = await M('contactFidelity.js');
const sb = await M('solverBot.js');
const dm = await M('dangerMap.js');
const { playerBoxAt } = await M('playerPhysicsV2.js');
const { parseTape } = await M('tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await M('tapeRunner.js');
const { patchedMapDocument } = await M('seedlingSetPatches.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const W = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const T = Number(process.argv[3]);
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(W.tape))));
const src = levelSourceFromAtlas(patchedMapDocument(MAP));
const probes = [];
globalThis.__DBG_CORRIDOR_PROBE = (wps, walk, hit) => probes.push({ wps, walk, hit });
const off = sb.solveSegment({ run: createRunForStaging(staging, src), goals: W.goals, name: 'fc', boot: staging.boot,
    forkRun: () => createRunForStaging(staging, src) });
globalThis.__DBG_CORRIDOR_PROBE = null;
const clean = probes.filter((p) => !p.hit).at(-1) ?? probes[0];
console.log('probes', probes.map((p) => `${p.walk.startTick}:${p.hit ? 'hit' + p.hit.tick : 'clean'}`).join(' '));
const drv = createRunForStaging(staging, src);
const samples = clean.walk.samples;
for (let i = 0; i < off.perTick.length && drv.ticksCompleted < T + 1; i += 1) {
    const s = samples.find((x) => x.tick === drv.ticksCompleted + 1);
    const pre = { x: drv.state.x, y: drv.state.y };
    drv.advance(off.perTick[i]);
    if (drv.ticksCompleted >= T - 3) {
        const live = (drv.entities('chasers') ?? []).map((c) => `${c.id}@(${c.x.toFixed(2)},${c.y.toFixed(2)}) ht${c.hitsTimer}`);
        const fc = (s?.chasers ?? []).map((c) => `${c.id}@(${c.x.toFixed(2)},${c.y.toFixed(2)}) ht${c.hitsTimer}`);
        const d = s ? dm.dangerDuringTransit(drv, s.tick, playerBoxAt(s.x, s.y), s.arrows, s.chasers) : null;
        console.log(`t${drv.ticksCompleted} drive pre (${pre.x.toFixed(2)},${pre.y.toFixed(2)}) preview (${s?.x?.toFixed(2)},${s?.y?.toFixed(2)}) held drive=${[...off.perTick[i]].join('+')} prev=${[...(s?.held ?? [])].join('+')}`);
        console.log('   live', live.join(' '), '\n   fc  ', fc.join(' '), '\n   danger', d?.danger, (d?.sources ?? []).map((x) => x.id + ' ' + x.why).join('; ').slice(0, 300));
    }
}
console.log("hits", JSON.stringify(drv.ledger("playerHits"))); console.log("press", JSON.stringify((drv.chaserPressHits ?? []).filter((h) => h.t >= 10 && h.t <= 20))); console.log("probe", JSON.stringify(clean.walk.samples.filter((s) => s.tick >= 10 && s.tick <= 18).map((s) => [s.tick, [...(s.held ?? [])].join("+")])));
