// usage: node tapefreeze.mjs <repoRoot> <tape.json>  — model observations ON vs OFF; print statue distance at releases + first diff
import { readFileSync } from 'node:fs';
const [root, file] = process.argv.slice(2);
const M = `${root}/frontend/modules/seedlingDemo`;
const { createTapeStepper } = await import(`${M}/tapeRunner.js`);
const { parseTape } = await import(`${M}/tapeFormat.js`);
const { atlasLevelSource } = await import(`${M}/levelSource.js`);
const { withContactFidelity } = await import(`${M}/contactFidelity.js`);
const levelSource = atlasLevelSource();
const tape = readFileSync(file, 'utf8');
const run = (on) => withContactFidelity({ statueTalkRange: on }, () => {
    const st = createTapeStepper(parseTape(tape), { levelSource });
    const col = []; let r = st.next();
    while (!r.done) { col[r.value.observation.t] = r.value.observation; r = st.next(); }
    return col;
});
const off = run(false), on = run(true);
const t = JSON.parse(tape);
const prim = new Set(); for (const i of t.inputs) if (i.key === 'primary') for (let k = i.from; k < i.to; k++) prim.add(k);
const statues = { 0: [208, 160], 87: [248, 184] };
for (const k of [...prim].sort((a, b) => a - b)) {
    if (prim.has(k + 1)) continue; const o = off[k + 1]; if (!o) continue; const s = statues[o.level]; if (!s) continue;
    const d = Math.hypot(o.x - s[0], o.y - s[1]); if (d <= 40) console.log(`release at t${k + 1} L${o.level} d=${d.toFixed(2)}`);
}
const n = Math.max(off.length, on.length); let first = null;
for (let i = 0; i < n; i++) { const a = off[i], b = on[i]; if (!a || !b || a.x !== b.x || a.y !== b.y || a.level !== b.level) { first = i; break; } }
console.log('ticks off', off.length, 'on', on.length, 'first ON/OFF diff', first, first !== null ? JSON.stringify({ off: off[first] && [off[first].x, off[first].y], on: on[first] && [on[first].x, on[first].y] }) : '');
