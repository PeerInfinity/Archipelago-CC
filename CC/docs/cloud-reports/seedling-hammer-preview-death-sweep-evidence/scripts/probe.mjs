// SCRATCH (PDS D2): what each fixed site answers on staging A, with no pool / a pool / every previewed step dying.
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { readFileSync } = await import('node:fs');
const SB = await import(M + 'solverBot.js');
const { deathRefusal } = await import(M + 'playerPhysicsV2.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const STAGING = solveStaging(stagingFromTape(parseTape(readFileSync(M + 'fixtures/hammer-p1-l40-south-boot.json', 'utf8'))));
const runOf = (dies = null) => {
    const run = createRunForStaging(STAGING, atlasLevelSource());
    if (dies) {
        const base = run.previewStepper.bind(run);
        run.previewStepper = (...a) => { const step = base(...a); return (st, k, o) => { const out = step(st, k, o); const s = out.state ?? out;
            if (dies(s)) throw deathRefusal({ level: 40 }, s, { source: 'water' }); return out; }; };
    }
    return run;
};
const tryIt = (f) => { try { return f(); } catch (e) { return { THREW: e.message.slice(0, 90) }; } };
const all = () => true;
console.log('state', JSON.stringify(runOf().state).slice(0, 200));
const r0 = SB.deriveRefuge(runOf(), new Set(), 45);
console.log('refuge none', JSON.stringify(r0));
const near = (p, r = 6) => (s) => Math.abs(s.x - p.x) <= r && Math.abs(s.y - p.y) <= r;
if (r0) console.log('refuge pool', JSON.stringify(tryIt(() => SB.deriveRefuge(runOf(near(r0)), new Set(), 45))));
console.log('refuge all', JSON.stringify(tryIt(() => SB.deriveRefuge(runOf(all), new Set(), 45))));
console.log('paced none', JSON.stringify(tryIt(() => { const o = SB.planPacedWait(runOf(), { ticks: 20 }); return { plan: !!o.plan, tried: o.tried.slice(0, 3), n: o.tried.length }; })));
console.log('paced all', JSON.stringify(tryIt(() => { const o = SB.planPacedWait(runOf(all), { ticks: 20 }); return { plan: !!o.plan, tried: o.tried.slice(0, 3), n: o.tried.length }; })));
const st = runOf().state;
for (const key of ['left', 'right', 'up', 'down']) console.log('lean', key, JSON.stringify(tryIt(() => SB.previewLean(runOf(), st, key))), JSON.stringify(tryIt(() => SB.previewLean(runOf(all), st, key))));
for (const d of [0, 1, 2, 3]) console.log('tap', d, JSON.stringify(tryIt(() => SB.previewFaceTap(runOf(), st, d))), JSON.stringify(tryIt(() => SB.previewFaceTap(runOf(all), st, d))));
const wps = [{ x: st.x - 40, y: st.y }];
const pd = (run) => tryIt(() => { const o = SB.planSwordDash(run, wps, { tolerance: 0, dashMode: 'all' }); return { plan: !!o.plan, why: (o.why ?? '').slice(0, 160), baseline: o.baseline }; });
console.log('dash none', JSON.stringify(pd(runOf())));
console.log('dash all', JSON.stringify(pd(runOf(all))));
console.log('walk all', JSON.stringify(tryIt(() => { const w = SB.previewWalkOrDeath(runOf(all), wps, 0, {}); return { n: w.samples.length, t: w.truncated }; })));
