// SCRATCH (PDS D2): deriveRefuge at G1's witness t972 (hammerRefugeCut's tick); and the L32 encounter search.
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { readFileSync } = await import('node:fs');
const SB = await import(M + 'solverBot.js');
const { deathRefusal } = await import(M + 'playerPhysicsV2.js');
const { createRunForStaging, createTapeStepper, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const tryIt = (f) => { try { return f(); } catch (e) { return { THREW: e.message.slice(0, 90) }; } };
const poison = (run, dies) => { const base = run.previewStepper.bind(run);
    run.previewStepper = (...a) => { const step = base(...a); return (st, k, o) => { const out = step(st, k, o); const s = out.state ?? out;
        if (dies(s)) throw deathRefusal({ level: run.level }, s, { source: 'water' }); return out; }; }; return run; };
function runAt(url, T) {
    const tape = parseTape(readFileSync(url, 'utf8'));
    const held = []; const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h) => { held[t] = h; } });
    for (let r = st.next(); !r.done; r = st.next());
    const run = createRunForStaging({ ...stagingFromTape(tape), equips: [] }, atlasLevelSource());
    for (const k of held.filter(Boolean)) { if (run.ticksCompleted >= T) break; run.advance(k); }
    return run;
}
const G1 = M + 'fixtures/hammer-g1-ghostkill-witness/hammer-g1-l40-ghostkill.tape.json';
for (const T of [972, 1251]) {
    const r0 = SB.deriveRefuge(runAt(G1, T), new Set(), 45);
    const near = (s) => Math.abs(s.x - r0.x) <= 6 && Math.abs(s.y - r0.y) <= 6;
    console.log(T, 'none', JSON.stringify(r0), 'pool', JSON.stringify(tryIt(() => SB.deriveRefuge(poison(runAt(G1, T), near), new Set(), 45))),
        'all', JSON.stringify(tryIt(() => SB.deriveRefuge(poison(runAt(G1, T), () => true), new Set(), 45))));
}
// L32: advance the bobboss tape until a forecast exists
const tape = parseTape(readFileSync(M + 'fixtures/tapes/r5-bobboss-fire.json', 'utf8'));
const held = []; const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h) => { held[t] = h; } });
for (let r = st.next(); !r.done; r = st.next());
const staging = solveStaging(stagingFromTape(tape));
let found = null;
for (let T = 0; T < held.length; T += 10) {
    const run = createRunForStaging(staging, atlasLevelSource());
    for (const k of held.filter(Boolean)) { if (run.ticksCompleted >= T) break; run.advance(k); }
    const boss = run.entities('bobBoss')?.get?.('boss');
    if (run.bobBossForecast() && boss && !boss.destroy) { const p = tryIt(() => SB.searchEncounterStrike(run)); if (p && !p.none && !p.THREW) { found = T; console.log('L32', T, JSON.stringify(p)); break; } }
}
console.log('L32 found', found, held.length);
