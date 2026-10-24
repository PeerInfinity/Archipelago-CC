// scratch (hammer-p1): the forecast shift vs a fresh forecast, tick by tick over a tape's walk
//   node fcast-diff.mjs <tape> [H]
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { loadTape } = await import(M + 'fixtures/index.js');
const { createRunForStaging, createTapeStepper, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { withPressKillCost, PRESS_KILL_COST_COUNTS, resetPressKillCostCounts } = await import(M + 'pressKillCost.js');
const name = process.argv[2]; const H = Number(process.argv[3] ?? 256);
const tape = loadTape(name);
const staging = stagingFromTape(tape);
const held = [];
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h) => { held[t] = h; } });
for (let r = st.next(); !r.done; r = st.next());
const keys = held.filter(Boolean);
const on = createRunForStaging(staging, atlasLevelSource());
const off = withPressKillCost(false, () => createRunForStaging(staging, atlasLevelSource()));
resetPressKillCostCounts();
let diverged = [];
let asked = 0;
for (let t = 0; t < keys.length; t += 1) {
    const a = withPressKillCost(true, () => on.spinnerForecast(H));
    const b = withPressKillCost(false, () => off.spinnerForecast(H));
    if (a.length) asked += 1;
    if (JSON.stringify(a) !== JSON.stringify(b)) diverged.push(t);
    try {
        withPressKillCost(true, () => on.advance(keys[t]));
        withPressKillCost(false, () => off.advance(keys[t]));
    } catch (e) { console.log('advance threw at', t, String(e.message).slice(0, 100)); break; }
}
console.log(JSON.stringify({ name, ticks: keys.length, asked, diverged: diverged.length, first: diverged.slice(0, 5), counts: { ...PRESS_KILL_COST_COUNTS } }));
