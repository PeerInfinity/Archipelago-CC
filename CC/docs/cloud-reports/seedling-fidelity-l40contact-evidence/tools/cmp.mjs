// L40CONTACT: replay a tape in the model (switches from env) and compare a body class against a probe's --out rows.
// node cmp.mjs <tape.json> <game.json> [--class=Bob|Spinner] [--upto=N] [--window=a-b]
import { readFileSync } from 'node:fs';
const R = (process.env.REPO ?? '/home/user/Archipelago-CC') + '/frontend/modules/seedlingDemo/';
const { parseTape } = await import(R + 'tapeFormat.js');
const { createTapeStepper } = await import(R + 'tapeRunner.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const { CONTACT_FIDELITY } = await import(R + 'contactFidelity.js');
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const CLASS = arg('class') ?? 'Bob';
const UPTO = arg('upto') === null ? Infinity : Number(arg('upto'));
const WIN = arg('window')?.split('-').map(Number) ?? null;
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const game = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const col = [];
let run = null;
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let r = st.next();
while (!r.done) {
    const o = r.value.observation;
    const ch = !run ? [] : (CLASS === 'Spinner' ? run.entities('spinnerBodies') : run.entities('chasers'));
    col[o.t] = { px: o.x, py: o.y, hits: run?.ledger?.('playerHits')?.length ?? 0,
        bodies: new Map(ch.map((c) => [c.id, { x: c.x, y: c.y }])) };
    r = st.next();
}
let first = null; let worst = 0; let n = 0; const firstById = {};
const byT = new Map();
for (const row of game.rows) { if (row.t > UPTO) continue; (byT.get(row.t) ?? byT.set(row.t, []).get(row.t)).push(row.game); }
for (const [t, gs] of [...byT].sort((a, b) => a[0] - b[0])) {
    const ms = [...(col[t]?.bodies ?? new Map())].map(([id, b]) => ({ id, ...b }));
    // one-to-one: greedy by distance over all pairs (label-free; the probe's own join is its OFF model's nearest)
    const pairs = [];
    for (let i = 0; i < gs.length; i += 1) for (const m of ms) pairs.push([Math.max(Math.abs(m.x - gs[i].x), Math.abs(m.y - gs[i].y)), i, m]);
    pairs.sort((a, b) => a[0] - b[0]);
    const gUsed = new Set(); const mUsed = new Set();
    for (const [d, i, m] of pairs) {
        if (gUsed.has(i) || mUsed.has(m.id)) continue;
        gUsed.add(i); mUsed.add(m.id); n += 1;
        if (d > worst) worst = d;
        if (d > 1e-9) {
            if (!firstById[m.id]) firstById[m.id] = { t, game: [gs[i].x, gs[i].y], model: [m.x, m.y], d };
            if (first === null) first = { t, id: m.id, game: [gs[i].x, gs[i].y], model: [m.x, m.y] };
        }
        if (WIN && t >= WIN[0] && t <= WIN[1] && m.id.includes(arg('only') ?? '')) console.log(t, m.id, 'game', gs[i].x.toFixed(3), gs[i].y.toFixed(3), 'model', m.x.toFixed(3), m.y.toFixed(3), 'player', col[t]?.px.toFixed(3), col[t]?.py.toFixed(3));
    }
    if (gs.length !== ms.length && first === null) first = { t, count: [gs.length, ms.length] };
}
const last = col.length - 1;
console.log(JSON.stringify({ chaserSpinnerWalls: CONTACT_FIDELITY.chaserSpinnerWalls, ticks: last, compared: n, worst, first, firstById,
    endPlayer: col[last] && [col[last].px, col[last].py], hits: col[last]?.hits }));
