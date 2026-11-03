// L100LATTICE D3: fidelityL100's `l100-sliver-rock` plan (fineSwingStance ON) with fineStanceWalk OFF vs ON; writes the
// ON plan as a walk tape for a game witness. Usage: node sliver.mjs [--out=<tape.json>]
import { readFileSync, writeFileSync } from 'node:fs';
const REPO = new URL('../../../../../', import.meta.url).pathname;
const M = REPO + 'frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { solveSegment } = await import(M + 'solverBot.js');
const { buildStagedTape } = await import(M + 'botDriverV1.js');
const { DEFAULT_DASH_MODE } = await import(REPO + 'scripts/procgen/dashMode.js');
const SLIVER = parseTape(readFileSync(M + 'fixtures/tapes/l100-sliver-rock.json', 'utf8'));
const stagingOf = () => { const s = solveStaging(stagingFromTape({ ...SLIVER, inputs: [], tick_count: 0 })); s.equips = []; return s; };
const out = process.argv.find((a) => a.startsWith('--out='))?.slice(6);
for (const on of [false, true]) {
    const staging = stagingOf();
    const run = createRunForStaging(staging, atlasLevelSource());
    const t0 = Date.now();
    const r = withContactFidelity({ fineSwingStance: true, fineStanceWalk: on }, () => solveSegment({ run,
        goals: [{ kind: 'reach-exit', exit: { x: 288, y: 96 } }], name: 'l100', boot: staging.boot, dashMode: DEFAULT_DASH_MODE }));
    console.log(`fineStanceWalk ${on}: ${r.perTick.length} t, level ${run.level}, hits ${run.playerHits.length}, ${Date.now() - t0} ms`);
    for (const row of r.trace.rows) console.log('  t' + row.tick, row.goal?.aim ? `aim(${row.goal.aim.x},${row.goal.aim.y})` : '',
        row.obstacle?.id ?? '', row.strategy?.verb ?? '', row.strategy?.lattice ? 'lattice=8' : '',
        row.path ? JSON.stringify(row.path.map((p) => [p.x, p.y])) : '', row.strategy?.swordDash ? `dash planned=${row.strategy.swordDash.planned} saved=${row.strategy.swordDash.saved}` : '');
    if (on && out) {
        const built = buildStagedTape({ staging: stagingOf(), perTick: r.perTick, name: 'l100lattice-sliver-on' });
        writeFileSync(out, `${JSON.stringify(built, null, 1)}\n`);
    }
}
