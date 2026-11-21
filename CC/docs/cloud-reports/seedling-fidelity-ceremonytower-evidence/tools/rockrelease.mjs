// The rock-release probe: replay a committed tape (or a key script) with `.oel` rows injected into one level, OFF and
// ON, and print the rock falls, the hits and every chaser/turret/drill per tick around the fall.
// Usage: node tools/rockrelease.mjs '<json spec>' where spec = {tape?: path, level, inject: [...], over: {...},
//   boot?, keys?: [[fromTick, toTick, [keys]]...], ticks?, window?: [a, b], grants?}
import { readFileSync } from 'node:fs';
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { createLevelRun } from '../../../../../frontend/modules/seedlingDemo/levelRun.js';
import { parseTape } from '../../../../../frontend/modules/seedlingDemo/tapeFormat.js';
import { createTapeStepper } from '../../../../../frontend/modules/seedlingDemo/tapeRunner.js';
const spec = JSON.parse(process.argv[2]);
const atlas = structuredClone(loadAtlas());
const L = atlas.levels.find((l) => l.level === spec.level);
L.entities = L.entities.filter((e) => !(spec.remove ?? []).includes(e.type)).concat(spec.inject ?? []);
const src = levelSourceFromAtlas(atlas);
const snap = (run, t) => ({ t, lvl: run.level, p: [run.state.x, run.state.y],
    ch: (run.entities('chasers') ?? []).map((c) => [c.id, +c.x.toFixed(3), +c.y.toFixed(3), c.hitsTimer]),
    dr: (run.drills?.bodies ?? []).map((d) => [d.id, d.x, d.y, d.anim]),
    sh: [...(run.shooters ?? new Map()).values?.() ?? []].map((s) => [s.id, s.shootTimer, s.anim]) });
function go(over) {
    return withContactFidelity(over, () => {
        const rows = []; let run = null; let thrown = null;
        try {
            if (spec.tape) {
                const raw = JSON.parse(readFileSync(spec.tape, 'utf8')); const tape = parseTape(JSON.stringify(raw.tape ?? raw));
                const st = createTapeStepper(tape, { levelSource: src, onTick: (t, s, h, rn) => { run = rn; } });
                let r = st.next(); let t = 0;
                while (!r.done) { if (run) rows.push(snap(run, ++t)); r = st.next(); }
            } else {
                run = createLevelRun({ levelSource: src, boot: spec.boot, pins: ['sound', 'dead_frames'],
                    roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'], ...(spec.grants ? { grants: spec.grants } : {}) });
                for (let k = 0; k < (spec.ticks ?? 40); k += 1) {
                    const ks = (spec.keys ?? []).filter(([a, b]) => k >= a && k < b).flatMap(([, , v]) => v);
                    run.advance(new Set(ks)); rows.push(snap(run, k + 1));
                }
            }
        } catch (e) { thrown = e.message.slice(0, 300); }
        return { thrown, rows, falls: run?.rockFalls?.map((f) => [f.t, f.id, f.deadFrames]) ?? null,
            hits: run ? run.ledger('playerHits').map((h) => [h.t, h.source, h.id]) : null,
            spits: run ? run.spitEvents.map((e) => [e.t, e.what, e.id]) : null };
    });
}
const off = go({ ...(spec.over ?? {}), freezeEdgeFrames: false });
const on = go({ ...(spec.over ?? {}), freezeEdgeFrames: true });
const [a, b] = spec.window ?? [0, 1e9];
console.log(JSON.stringify({ off: { thrown: off.thrown, falls: off.falls, hits: off.hits, spits: off.spits }, on: { thrown: on.thrown, falls: on.falls, hits: on.hits, spits: on.spits } }));
const n = Math.max(off.rows.length, on.rows.length); let diff = 0;
for (let i = 0; i < n; i += 1) {
    const x = JSON.stringify(off.rows[i]); const y = JSON.stringify(on.rows[i]);
    if (x !== y) diff += 1;
    if (i + 1 >= a && i + 1 <= b) console.log(x === y ? '  =' : '  ≠', 'OFF', x, x === y ? '' : `\n     ON  ${y}`);
}
let first = -1; for (let i = 0; i < n && first < 0; i += 1) if (JSON.stringify(off.rows[i]) !== JSON.stringify(on.rows[i])) first = i + 1;
console.log('rows', n, 'differing', diff, 'first', first);
