// L39PHANTOM W0/D0 (measure only): replay an l39shaft game witness's tape in the model; per spinner, the tick its
// `destroy` goes up, its `removed`, and the source (pulserEnemyKills / spinnerPressHits landed), against the game's
// spinner count drops. Usage: node l39-deaths.mjs <witness.json> [set]
import { readFileSync } from 'node:fs';
const REPO = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const W = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { l39LevelSource, unpackL39Sample } = await import(REPO + 'fidelityL39Shaft.js');
const { parseTape } = await import(REPO + 'tapeFormat.js');
const { createTapeStepper } = await import(REPO + 'tapeRunner.js');
const { withContactFidelity, CONTACT_FIDELITY_KEYS } = await import(REPO + 'contactFidelity.js');
const over = {}; for (const k of (W.on ?? [])) over[k] = true;
const levelSource = await l39LevelSource(W.set ?? 'vanilla');
const tape = parseTape(JSON.stringify(W.tape));
const game = W.samples.map(unpackL39Sample);
let gPrev = null;
for (const g of game) { if (g.level === 39 && g.spinners.length !== gPrev) { console.log(`GAME t${g.t} spinners ${g.spinners.length}`); gPrev = g.spinners.length; } }
withContactFidelity(over, () => {
    let run = null; const seen = new Map(); let pk = 0; let ph = 0;
    const st = createTapeStepper(tape, { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
    let r = st.next();
    while (!r.done) {
        const t = r.value.observation.t;
        if (run && run.level === 39) {
            for (const b of run.entities('spinnerBodies')) {
                const p = seen.get(b.id) ?? {};
                if (b.destroy && p.destroyAt == null) { p.destroyAt = t; p.at = [b.x, b.y]; p.alpha = b.alpha; }
                p.last = t; seen.set(b.id, p);
            }
            const kills = run.pulserEnemyKills; while (pk < kills.length) console.log('MODEL pulserEnemyKill', JSON.stringify(kills[pk++]), 'obs t', t);
            const hits = run.ledger('spinnerPressHits') ?? []; while (ph < hits.length) { const h = hits[ph++]; if (h.landed) console.log('MODEL pressHit landed', JSON.stringify(h).slice(0, 200), 'obs t', t); }
        }
        r = st.next();
    }
    for (const [id, p] of seen) console.log('MODEL', id, 'destroy@', p.destroyAt, 'at', p.at, 'lastListed@', p.last);
});
