// L100LATTICE: survey step 219's segment (L100 -> L101) from its boot, summarised. Env picks the arm
// (SEEDLING_FINE_STANCE_WALK=0|1). Usage: node seg219.mjs <boot.json> [--keys=<out.json>]
import { readFileSync, writeFileSync } from 'node:fs';
const REPO = new URL('../../../../../', import.meta.url).pathname;
const M = REPO + 'frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { solveSegment } = await import(M + 'solverBot.js');
const { CONTACT_FIDELITY } = await import(M + 'contactFidelity.js');
const atlas = JSON.parse(readFileSync(REPO + 'frontend/modules/flashPanel/atlases/seedling-map.json'));
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const staging = solveStaging(stagingFromTape(tape));
const run = createRunForStaging(staging, levelSourceFromAtlas(atlas));
const keysOut = process.argv.find((a) => a.startsWith('--keys='))?.slice(7);
console.log('fineStanceWalk', CONTACT_FIDELITY.fineStanceWalk, 'waterfallPushPricing', CONTACT_FIDELITY.waterfallPushPricing);
const t0 = Date.now();
try {
    const r = solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 288, y: 96 } }], name: 'l100', boot: staging.boot });
    console.log('SOLVED ticks', r.perTick.length, 'ms', Date.now() - t0, 'level now', run.level);
    for (const row of r.trace.rows) {
        console.log(' row t' + row.tick, JSON.stringify(row.saw ? { x: +row.saw.x.toFixed(2), y: +row.saw.y.toFixed(2), l: row.saw.level } : null),
            row.goal?.aim ? `aim(${row.goal.aim.x},${row.goal.aim.y})` : '', row.obstacle?.id ?? '', row.strategy?.verb ?? '',
            row.strategy?.lattice ? 'lattice=' + row.strategy.lattice : '', row.path ? JSON.stringify(row.path.map((p) => [p.x, p.y])) : '');
    }
    console.log('fineLatticeWalks', JSON.stringify(r.fineLatticeWalks ?? null));
    console.log('playerHits', JSON.stringify(run.ledger('playerHits')));
    console.log('forcedHits', JSON.stringify(r.forcedHits ?? null));
    if (keysOut) writeFileSync(keysOut, JSON.stringify({ boot: staging.boot, perTick: r.perTick.map((k) => (k instanceof Set ? [...k] : k)) }));
} catch (e) {
    console.log('REFUSED ms', Date.now() - t0, e.message.slice(0, 900));
    for (const row of e.rows ?? []) {
        console.log(' row t' + row.tick, row.goal?.aim ? `aim(${row.goal.aim.x},${row.goal.aim.y})` : '', row.obstacle?.id ?? '',
            row.strategy?.verb ?? '', row.strategy?.lattice ? 'lattice=' + row.strategy.lattice : '', row.path ? JSON.stringify(row.path.map((p) => [p.x, p.y])) : '');
    }
}
