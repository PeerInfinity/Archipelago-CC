// SCRATCH (seedling-hammer-sf D1): replay a committed walk and, at sampled ticks, derive the strike on each live
// spinner under OFF / floor-only / a / b (the lab knob), to find the gate rows' states:
//   (1) ON presses earlier and its cell's OFF floor skipped that tick; (2) floor-only refuses and ON keeps a strike.
//   node probe-rows.mjs --tape=<tape.json> [--every=10] [--to=2300] [--cont=1]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const { deriveStrike, STRIKE_ETA_FLOOR } = await M('solverBot.js');
const { createRunForStaging, createTapeStepper, stagingFromTape } = await M('tapeRunner.js');
const { parseTape } = await M('tapeFormat.js');
const { atlasLevelSource } = await M('levelSource.js');
const tape = parseTape(readFileSync(arg('tape'), 'utf8'));
const held = [];
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h) => { held[t] = h; } });
for (let r = st.next(); !r.done; r = st.next());
const run = createRunForStaging({ ...stagingFromTape(tape), equips: [] }, atlasLevelSource());
const EVERY = Number(arg('every', '10')); const TO = Number(arg('to', '2300')); const CONT = arg('cont', '0') === '1';
const variant = (v, fn) => { const was = { ...STRIKE_ETA_FLOOR }; STRIKE_ETA_FLOOR.enabled = v !== 'off';
    STRIKE_ETA_FLOOR.shape = v === 'off' ? undefined : v; try { return fn(); } finally { Object.assign(STRIKE_ETA_FLOOR, was); } };
const sum = (r) => (r === null ? null : r.cell === null ? 'REFUSED' : `${r.cell.x},${r.cell.y}@${r.pressAt}/eta${r.eta}${r.fromContinuation ? 'c' : ''}`);
const keys = held.filter(Boolean);
for (let k = 0; k < keys.length && run.ticksCompleted <= TO; k += 1) {
    if (run.ticksCompleted % EVERY === 0) {
        for (const b of run.entities('spinnerBodies') ?? []) {
            const out = { t: run.ticksCompleted, body: b.id };
            for (const v of ['off', 'floor', 'a', 'b']) {
                const t0 = Date.now();
                const r = variant(v, () => deriveStrike(run, b.id, new Set(), b.hitsTimer > 0 ? b.hitsTimer : 0, { continuation: CONT }));
                out[v] = sum(r); out[`${v}ms`] = Date.now() - t0;
            }
            console.log(JSON.stringify(out));
        }
    }
    run.advance(keys[k]);
}
