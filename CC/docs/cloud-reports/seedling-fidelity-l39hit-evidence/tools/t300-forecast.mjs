// MEASURE ONLY: L39SHAFT D2's state at t300; spinner forecasts (OFF/ON) vs a run that holds no keys from t300.
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape, heldKeysAt } = await import(R + 'tapeFormat.js');
const { stagingFromTape, createRunForStaging } = await import(R + 'tapeRunner.js');
const { l39LevelSource } = await import(R + 'fidelityL39Shaft.js');
const { withContactFidelity } = await import(R + 'contactFidelity.js');
const D2 = JSON.parse(readFileSync(R + 'fixtures/l39shaft-witness/l39shaft-solver-step66.json', 'utf8'));
const tape = parseTape(JSON.stringify(D2.tape));
const ls = await l39LevelSource('delivered');
const N = 300, H = Number(process.env.H ?? 1500);
const at = () => { const st = stagingFromTape(tape); const run = createRunForStaging({ ...st, equips: st.equips.filter((e) => e.t < N) }, ls);
    for (let t = 0; t < N; t += 1) run.advance(new Set(heldKeysAt(tape, t))); return run; };
const truth = at(); const rows = [];
for (let i = 0; i < H; i += 1) { truth.advance(new Set()); rows.push(Object.fromEntries(truth.entities('spinnerBodies').map((b) => [b.id, [b.x, b.y]]))); }
console.log('pulserHits after t300 (standing run):', truth.ledger('pulserHits').filter((h) => h.t > N).length, 'playerHits', truth.ledger('playerHits').filter((h) => h.t > N).length);
for (const on of [false, true]) withContactFidelity({ pulserForecastPulse: on }, () => {
    const run = at(); const ids = run.entities('spinnerBodies').map((b) => b.id); const f = run.spinnerForecast(H);
    for (const id of ids) {
        let first = null;
        for (let i = 0; i < H; i += 1) { const r = f[i][ids.indexOf(id)]; const a = rows[i][id]; if (!a || !r) continue;
            if (Math.hypot(r.x + 4 - a[0], r.y + 4 - a[1]) > 1e-6) { first = { t: N + 1 + i, d: +Math.hypot(r.x + 4 - a[0], r.y + 4 - a[1]).toFixed(3) }; break; } }
        console.log(on ? 'ON ' : 'OFF', id, 'first divergence from the standing run:', JSON.stringify(first));
    }
});
