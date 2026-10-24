// SCRATCH (SFF2 D2): the pressKillCost P2 sibling's three derivations, P2 ON / OFF, with the counter decomposed.
const root = process.argv[2];
const M = (p) => import(`${root}/frontend/modules/seedlingDemo/${p}`);
const { readFileSync } = await import('node:fs');
const { deriveStrike } = await M('solverBot.js');
const { withPressKillCost } = await M('pressKillCost.js');
const SB = await M('solverBot.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await M('tapeRunner.js');
const { parseTape } = await M('tapeFormat.js');
const { atlasLevelSource } = await M('levelSource.js');
const withStrikeScanCost = SB.withStrikeScanCost ?? (await M('pressKillCost.js')).withStrikeScanCost;
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(
    `${root}/frontend/modules/seedlingDemo/fixtures/hammer-p1-l40-south-boot.json`, 'utf8'))));
const derivations = (on) => withPressKillCost(true, () => withStrikeScanCost(on, () => {
    const run = createRunForStaging(staging, atlasLevelSource());
    const out = {};
    for (const [k, args] of [['first', ['spinner@880,848', new Set(), 0, { continuation: true }]],
        ['again', ['spinner@880,848', new Set(), 0]], ['far', ['spinner@192,144', new Set(), 0]]]) {
        globalThis.__D2 = {};
        const d = deriveStrike(run, ...args);
        out[k] = { cell: d.cell, etaSkipped: d.etaSkipped, capSkipped: d.capSkipped, scanned: d.scanned, D: globalThis.__D2 };
    }
    return out;
}));
console.log('P2 ON ', JSON.stringify(derivations(true)));
console.log('P2 OFF', JSON.stringify(derivations(false)));
