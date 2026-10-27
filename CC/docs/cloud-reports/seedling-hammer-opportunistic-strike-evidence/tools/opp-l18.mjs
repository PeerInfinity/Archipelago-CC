// L18 control: r9-solve-18 at each residue (the sweep's solveAt), every run instrumented.
const D = (process.env.OPP_ROOT ?? '/home/user/Archipelago-CC') + '/frontend/modules/seedlingDemo/';
const { loadTape } = await import(D + 'fixtures/index.js');
const { createRunForStaging, stagingFromTape } = await import(D + 'tapeRunner.js');
const { atlasLevelSource } = await import(D + 'levelSource.js');
const { twoPassSolve } = await import(D + 'twoPassSolve.js');
const { SPINNER } = await import(D + 'spinner.js');
const STAGING = stagingFromTape(loadTape('r9-solve-18'));
const P = SPINNER.hammerPeriod;
const RES = ((STAGING.seam.time % P) + P) % P;
const residues = (process.env.RES ?? '0-44').split(',').flatMap((x) => { const [a, b] = x.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); });
const verdicts = [];
for (const r of residues) {
    const shift = ((((r - RES) % P) + P) % P) - P;
    const seam = { ...STAGING.seam, time: STAGING.seam.time + shift };
    try {
        const res = await twoPassSolve({ makeRun: (persistence) => createRunForStaging({ ...STAGING, seam, persistence, equips: [] }, atlasLevelSource()),
            goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }], name: 'r9-solve-18', boot: STAGING.boot,
            persistence: STAGING.persistence.filter((c) => c.at === undefined), gameTick: async () => { throw new Error('no oracle'); } });
        verdicts.push(`${r}:${res.out.perTick.length}`);
    } catch (e) { verdicts.push(`${r}:REFUSED(${String(e.message).slice(0, 60)})`); }
}
console.log(`# L18 residues: ${verdicts.join(' ')}`);
globalThis.__oppReport(Boolean(process.env.MISSES));
