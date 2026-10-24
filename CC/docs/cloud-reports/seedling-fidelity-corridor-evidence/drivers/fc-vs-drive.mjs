// scratch: the corridor-body forecast stepped against the REAL drive's player, vs the live run, tick by tick.
//   node fc-vs-drive.mjs <tape.json> <goals.json|-> [name]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { withContactFidelity } = await M('contactFidelity.js');
const { solveSegment } = await M('solverBot.js');
const { parseTape } = await M('tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await M('tapeRunner.js');
const { patchedMapDocument } = await M('seedlingSetPatches.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const W = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(W.tape))));
const src = levelSourceFromAtlas(patchedMapDocument(MAP));
const perTick = W.perTick ?? withContactFidelity({ corridorBodyPricing: false }, () => solveSegment({
    run: createRunForStaging(staging, src), goals: W.goals, name: 'fc', boot: staging.boot,
    forkRun: () => createRunForStaging(staging, src) })).perTick;
const out = withContactFidelity({ corridorBodyPricing: true }, () => {
    const run = createRunForStaging(staging, src);
    const fc = run.corridorBodyForecast();
    if (!fc) return { none: true };
    let maxDx = 0; const swings = []; const contacts = []; const firstParting = [];
    let level = run.level;
    for (let i = 0; i < perTick.length; i += 1) {
        const slashing = run.progress('slashInfo')?.state?.slashing === true;
        const rows = fc.step(run.state, { slashing });
        const before = run.ticksCompleted;
        const pre = { x: run.state.x, y: run.state.y };
        const { transition } = run.advance(perTick[i]);
        if (transition || run.level !== level) break;
        const struck = (run.chaserPressHits ?? []).filter((h) => h.t === before && (h.tag === 'wallflyer' || h.tag === 'drill')
            && !String(h.why ?? '').startsWith('distanceRectPoint'));
        if (struck.length) {
            const ids = new Set(struck.map((h) => h.id));
            const got = fc.swing(pre, (rect, id) => ids.has(id));
            swings.push({ t: before + 1, live: struck.filter((h) => h.landed).map((h) => h.id), fc: got });
        }
        for (const r of rows) if (r.contact) contacts.push({ t: before + 1, id: r.id, lands: r.hitsPlayer });
        const live = [...(run.wallFlyers?.bodies ?? []), ...(run.drills?.bodies ?? [])];
        for (const r of rows) {
            const l = live.find((b) => b.id === r.id);
            if (!l) continue;
            const d = Math.max(Math.abs(l.x - r.x), Math.abs(l.y - r.y));
            if (d > maxDx) maxDx = d;
            if (d > 0 && firstParting.length < 3) firstParting.push({ t: before + 1, id: r.id, fc: [r.x, r.y], live: [l.x, l.y] });
        }
    }
    const hits = (run.ledger('playerHits') ?? []).filter((h) => h.source === 'wallflyer' || h.source === 'drill')
        .map((h) => ({ t: h.t, id: h.id }));
    return { swings, ticks: perTick.length, maxDx, firstParting, contacts, hits };
});
console.log(JSON.stringify(out));
