// SCRATCH (SFF2 D1): staging A (L40), the first derivation; previews into a "pool" around a cell drown.
const root = process.argv[2];
const M = (p) => import(`${root}/frontend/modules/seedlingDemo/${p}`);
const { readFileSync } = await import('node:fs');
const { deriveStrike } = await M('solverBot.js');
const { deathRefusal } = await M('playerPhysicsV2.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await M('tapeRunner.js');
const { parseTape } = await M('tapeFormat.js');
const { atlasLevelSource } = await M('levelSource.js');
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(
    `${root}/frontend/modules/seedlingDemo/fixtures/hammer-p1-l40-south-boot.json`, 'utf8'))));
const pool = JSON.parse(process.argv[3] ?? 'null');
const run = createRunForStaging(staging, atlasLevelSource());
let drowned = 0;
if (pool) {
    const base = run.previewStepper.bind(run);
    run.previewStepper = (...a) => {
        const step = base(...a);
        return (st, keys, opts) => {
            const out = step(st, keys, opts);
            const s = out.state ?? out;
            if (Math.abs(s.x - pool.x) <= pool.r && Math.abs(s.y - pool.y) <= pool.r) {
                drowned += 1;
                throw deathRefusal(run.level, s, { source: 'water' });
            }
            return out;
        };
    };
}
const t0 = Date.now();
try {
    const d = deriveStrike(run, 'spinner@880,848', new Set(), 0, { continuation: true });
    console.log(JSON.stringify({ cell: d.cell, eta: d.eta, pressAt: d.pressAt, considered: d.considered,
        scanned: d.scanned, etaSkipped: d.etaSkipped, rejected: d.rejected.slice(0, 3), drowned, ms: Date.now() - t0 }));
} catch (e) { console.log('THREW', e.name, e.message.slice(0, 120), 'drowned', drowned, Date.now() - t0, 'ms'); }
