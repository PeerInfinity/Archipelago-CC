// W0 attribution, one cell per call: build the cell's certification request exactly as capture.mjs does, replay the
// solve on a live run, and on the refusal answer the four questions the classification needs:
//   (a) did the run hold the key and is the lock OPEN (the game's keygate mechanism done)?
//   (b) is the goal pickup's centre reachable from where the run stands, ignoring only the pickup's OWN avoid volume
//       (the game's question: can the player walk onto the torch)?
//   (c) the refused aim: is it reachable at all, and is it beyond the pickup (only through the pickup's own cell)?
//   (d) is there, NOW, a ring stance a corridor reaches and that can collect (what a stance re-derived after the
//       clear would have aimed at)?
// Usage: node attribute.mjs <repo-root> <kind> <WxH> <seed> <palette>   (prints one JSON line)
import { join } from 'node:path';
const [REPO, kind, sizeArg, seedArg, paletteName] = process.argv.slice(2);
const M = (p) => import(join(REPO, 'frontend/modules', p));
const { seedlingSkeletonSpec, seedlingModel, pinsForRecord } = await M('seedlingDemo/procgenSeedling.js');
const { bootStaging } = await M('seedlingDemo/procgenOracle.js');
const { floodTerrainsFor, atlasOf } = await M('seedlingDemo/procgenLevel.js');
const { parseElementSpec } = await M('procgenCore/elementSpec.js');
const { parseAreaSpec } = await M('procgenCore/areaSpec.js');
const { levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
const { createRunForStaging } = await M('seedlingDemo/tapeRunner.js');
const { solveSegment, solverPlanOpts } = await M('seedlingDemo/solverBot.js');
const { planWaypoints } = await M('seedlingDemo/botDriverV2.js');
const palette = (await M('seedlingDemo/watchGenerate.js')).paletteWithTerrains(paletteName, '');
const [width, height] = sizeArg.split('x').map(Number);
const seed = Number(seedArg);
const items = palette.items ?? null;
const model = seedlingModel({ seed, floodTerrains: floodTerrainsFor(items, palette.floodWalks), defaults: { width, height },
    skeleton: seedlingSkeletonSpec(kind), elements: parseElementSpec('keygate'), areas: parseAreaSpec('0') });
const record = model.skeleton();
const staging = bootStaging({ boot: model.boot(), items, pins: pinsForRecord(record, []) });
const run = createRunForStaging(staging, levelSourceFromAtlas(atlasOf(record)), { scratchPersistence: true });
let err = null;
let out = null;
try {
    out = solveSegment({ run, goals: model.goals, name: `procgen-l${record.level}`, boot: staging.boot, maxTicksPerTarget: 400 });
} catch (e) { err = e; }
const plan = (to, extra = {}) => {
    try { return planWaypoints(run.world, run.state, to, null, solverPlanOpts(run, new Set(), extra)).length; } catch { return null; }
};
const lock = (run.world.activators ?? []).find((a) => a.tag === 'bosslock');
const torch = (run.world.pickups ?? []).find((p) => p.tag === 'torchpickup');
const centre = torch ? { x: (torch.rect.x + torch.rect.right) / 2, y: (torch.rect.y + torch.rect.bottom) / 2 } : null;
const aimM = /toward \((-?[\d.]+),(-?[\d.]+)\)/.exec(err?.message ?? '');
const aim = aimM ? { x: Number(aimM[1]), y: Number(aimM[2]) } : null;
// (d) the ring-1 cells around the torch, each asked: a corridor now (avoid volumes on), and an approach to the centre
const ring = [];
if (centre) {
    const tx = Math.floor(centre.x / 16), ty = Math.floor(centre.y / 16);
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
        const c = { x: (tx + dx) * 16 + 8, y: (ty + dy) * 16 + 8 };
        const walk = plan(c);
        let approach = null;
        try { approach = planWaypoints(run.world, c, centre, null, solverPlanOpts(run, new Set(), { avoidVolumes: false, nodeMargin: 0, triggerMargin: 0 })).length; } catch { /* none */ }
        ring.push({ cell: c, corridorNow: walk !== null, canCollect: approach !== null });
    }
}
console.log(JSON.stringify({
    cell: `${paletteName} ${kind} ${sizeArg} seed ${seed}`,
    verdict: err ? 'REFUSED' : 'SOLVED', ticks: out?.perTick?.length ?? err?.perTick?.length ?? null,
    keys: [...(run.progress('keys') ?? [])], lockOpen: lock ? run.entities('openActivators').has(lock.id) : null,
    lock: lock?.id ?? null, torch: torch ? `${torch.tag}@${torch.x},${torch.y}` : null,
    stateAtRefusal: { x: +run.state.x.toFixed(2), y: +run.state.y.toFixed(2) },
    aim, aimReachable: aim ? plan(aim) !== null : null, aimReachableIgnoringVolumes: aim ? plan(aim, { avoidVolumes: false }) !== null : null,
    torchReachableIgnoringOwnVolume: centre ? plan(centre, { avoidVolumes: false }) !== null : null,
    ringNow: ring, reStanceWouldWalk: ring.some((r) => r.corridorNow && r.canCollect),
    reason: err ? String(err.message).slice(0, 200) : null,
}));
