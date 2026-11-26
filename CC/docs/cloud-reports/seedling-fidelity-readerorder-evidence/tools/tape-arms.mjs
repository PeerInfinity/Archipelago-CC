#!/usr/bin/env node
// The planner's SWEEP CENSUS, as movers (wave 64): replay every committed tape under the shipped model and under each
// scratch arm, and diff the WHOLE `runTape` result (wave 56/61's `tape-onoff.mjs`, re-keyed to the scratch arms).
// Needs `scratch.py apply`. The baseline sets `globalThis.__RO = {}` too (the scratch writes `openBefore` and
// `__roPrevBox` on the activator state whenever `__RO` is set), so a difference is behaviour, never the extra fields.
//   ii    the readers read `openActivatorIdsBeforeStep`          iv    the responders' presses lag one step
//   ii+iv both      occ   the Enemy + same-frame occupancy alone      v   ii + iv + occ (the arm that closes every shape)
// Over: every `fixtures/tapes/*.json` and every `fixtures/**/*.tape.json`. usage: node tape-arms.mjs [--json=…]
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const { atlasLevelSource } = await import(`${ROOT}frontend/modules/seedlingDemo/levelSource.js`);
const { runTape } = await import(`${ROOT}frontend/modules/seedlingDemo/tapeRunner.js`);
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
const FIX = join(ROOT, 'frontend/modules/seedlingDemo/fixtures');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = [...readdirSync(join(FIX, 'tapes')).filter((f) => f.endsWith('.json')).map((f) => join(FIX, 'tapes', f)),
    ...walk(FIX).filter((p) => p.endsWith('.tape.json'))].sort();
const ARMS = { base: {}, ii: { arm: 'before' }, iv: { pressLag: true }, 'ii+iv': { arm: 'before', pressLag: true },
    occ: { occ: true }, v: { arm: 'before', pressLag: true, occ: true } };
const go = (tape, ro) => {
    globalThis.__RO = { ...ro, hits: [] };
    try { return JSON.stringify(runTape(tape, { levelSource: atlasLevelSource() })); } catch (e) { return `THROW ${String(e?.message ?? e).slice(0, 200)}`; }
};
const rows = [];
const movers = { ii: [], iv: [], 'ii+iv': [], occ: [], v: [] };
let shipped = 0;
for (const p of files) {
    let tape;
    try { tape = JSON.parse(readFileSync(p, 'utf8')); } catch { continue; }
    if (!tape?.inputs || !tape?.boot) continue;
    const name = relative(ROOT, p);
    delete globalThis.__RO;
    let plain;
    try { plain = JSON.stringify(runTape(tape, { levelSource: atlasLevelSource() })); } catch (e) { plain = `THROW ${String(e?.message ?? e).slice(0, 200)}`; }
    const r = { tape: name };
    for (const [k, ro] of Object.entries(ARMS)) r[k] = go(tape, ro);
    delete globalThis.__RO;
    if (r.base === plain) shipped += 1;
    const row = { tape: name, baseIsShipped: r.base === plain, throws: plain.startsWith('THROW') ? plain : null };
    for (const k of Object.keys(movers)) { row[k] = r[k] === r.base ? 'same' : 'DIFFERS'; if (r[k] !== r.base) movers[k].push(name); }
    rows.push(row);
    if (Object.keys(movers).some((k) => row[k] !== 'same') || !row.baseIsShipped) console.log(`${name}: ${Object.keys(movers).map((k) => `${k} ${row[k]}`).join(' · ')}${row.baseIsShipped ? '' : ' · BASE ≠ SHIPPED'}`);
}
console.log(`tapes ${rows.length}; the __RO baseline equals the untouched shipped run on ${shipped}/${rows.length}`);
for (const [k, v] of Object.entries(movers)) console.log(`arm ${k}: ${v.length} tape(s) whose whole result differs from the baseline${v.length ? `: ${v.join(', ')}` : ''}`);
const jo = arg('json', null);
if (jo) writeFileSync(jo, `${JSON.stringify({ tapes: rows.length, shippedEqualsBase: shipped, movers, rows }, null, 1)}\n`);
