// MISCRES D1: chaserForecastNow taken at t<from> on skinswing-l71-resite vs the live step (= the game at 0 px with
// removedBodyBlocks ON), forecastCorpseFade OFF vs ON; the tape's presses are mirrored with the forecast's own `hit`.
// Usage: node forecast-corpse-probe.mjs [from=58] [ticks=12] [before|after: the player point the press is aimed from]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const D = new URL('../../../../../frontend/modules/seedlingDemo/', import.meta.url).href;
const { withContactFidelity } = await import(D + 'contactFidelity.js');
const { SKINSWING_WITNESS_DIR } = await import(D + 'fidelitySkinSwing.js');
const { parseTape } = await import(D + 'tapeFormat.js');
const { createTapeStepper } = await import(D + 'tapeRunner.js');
const { atlasLevelSource } = await import(D + 'levelSource.js');
const rec = JSON.parse(readFileSync(join(SKINSWING_WITNESS_DIR, 'skinswing-l71-resite.json'), 'utf8'));
const from = Number(process.argv[2] ?? 58);
const n = Number(process.argv[3] ?? 12);
const mode = process.argv[4] ?? 'before';
for (const on of [false, true]) withContactFidelity({ removedBodyBlocks: true, forecastCorpseFade: on }, () => {
    let run = null;
    const st = createTapeStepper(parseTape(JSON.stringify(rec.tape)), { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    let r = st.next();
    while (r.value.observation.t < from) r = st.next();
    const fc = run.chaserForecast();
    const out = [];
    let worst = 0;
    for (let t = from + 1; t <= from + n; t++) {
        const before = { ...run.state };
        const hitsBefore = new Map(run.chasers.map((c) => [c.id, c.hits]));
        let proj = fc.step(before);
        r = st.next();
        // the tape's sword presses: a live body whose hits rose this tick takes the same press in the forecast
        // (`hit(id, playerPos)`, the strike policy's own call), from the player where the press was made
        const pressAt = mode === 'after' ? { ...run.state } : before;
        let pressed = false;
        for (const c of run.chasers) if (!c.removed && c.hits > (hitsBefore.get(c.id) ?? c.hits)) { fc.hit(c.id, pressAt); pressed = true; }
        if (pressed && fc.now) proj = fc.now();
        const live = run.chasers.filter((c) => !c.removed && !c.destroy);
        const bad = live.map((c) => { const f = proj.find((p) => p.id === c.id); return f ? Math.max(Math.abs(f.x - c.x), Math.abs(f.y - c.y)) : 'missing'; });
        for (const b of bad) if (typeof b === 'number') worst = Math.max(worst, b);
        out.push(`t${t}:${live.length}/${proj.length}:${bad.map((b) => (typeof b === 'number' ? b.toFixed(3) : b)).join(',')}`);
    }
    const firstOff = out.find((o) => o.split(':')[2].split(',').some((b) => b === 'missing' || Number(b) > 0.01));
    if (process.argv.includes('--first')) console.log(on ? 'ON ' : 'OFF', `from t${from}: first > 0.01 px:`, firstOff ?? 'none', `(worst ${worst.toFixed(3)})`);
    else console.log(on ? 'ON ' : 'OFF', `worst=${worst.toFixed(3)}`, out.join(' '));
});
