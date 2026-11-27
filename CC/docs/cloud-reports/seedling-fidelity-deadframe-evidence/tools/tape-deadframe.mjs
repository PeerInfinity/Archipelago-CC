#!/usr/bin/env node
// wave 66 (DEADFRAME): wave 65's `tape-order.mjs`, re-keyed: `--keys=a,b` are the ON arm's keys (default both of this
// wave's), `--base='{…}'` is added to BOTH arms. Original header (wave 65): every committed tape OFF vs ON (wave 64's `tape-arms.mjs`, re-keyed to
// `responderStepAfterReaders`; no scratch). The whole `runTape` result is diffed, and a mover lists the top-level fields
// that moved (and, for an array field, its first differing entry), so a ledger-only mover is told from a stream one.
// Over: every `fixtures/tapes/*.json` and every `fixtures/**/*.tape.json`.
// usage: node tape-order.mjs [--json=out.json] [--over='{"k":true}']   (--over is added to the ON arm only)
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const { atlasLevelSource } = await import(`${ROOT}frontend/modules/seedlingDemo/levelSource.js`);
const { runTape } = await import(`${ROOT}frontend/modules/seedlingDemo/tapeRunner.js`);
const { withContactFidelity } = await import(`${ROOT}frontend/modules/seedlingDemo/contactFidelity.js`);
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
const OVER = JSON.parse(arg('over', '{}'));
const KEYS = arg('keys', 'deadFrameResponderStep,enemyPressesFallRockButton').split(',');
const BASE = JSON.parse(arg('base', '{}'));
const offArm = { ...BASE, ...Object.fromEntries(KEYS.map((k) => [k, false])) };
const onArm = { ...BASE, ...OVER, ...Object.fromEntries(KEYS.map((k) => [k, true])) };
const FIX = join(ROOT, 'frontend/modules/seedlingDemo/fixtures');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = [...readdirSync(join(FIX, 'tapes')).filter((f) => f.endsWith('.json')).map((f) => join(FIX, 'tapes', f)),
    ...walk(FIX).filter((p) => p.endsWith('.tape.json'))].sort();
const go = (tape, over) => withContactFidelity(over, () => {
    try { return { ok: runTape(tape, { levelSource: atlasLevelSource() }) }; } catch (e) { return { throw: `${e?.name}: ${String(e?.message ?? e).slice(0, 200)}` }; }
});
const fieldDiff = (a, b) => {
    if (a.throw || b.throw) return a.throw === b.throw ? [] : [{ field: 'THROW', off: a.throw ?? null, on: b.throw ?? null }];
    const out = [];
    const keys = [...new Set([...Object.keys(a.ok), ...Object.keys(b.ok)])];
    for (const k of keys) {
        const x = JSON.stringify(a.ok[k]); const y = JSON.stringify(b.ok[k]);
        if (x === y) continue;
        const d = { field: k };
        if (Array.isArray(a.ok[k]) && Array.isArray(b.ok[k])) {
            const n = Math.max(a.ok[k].length, b.ok[k].length);
            for (let i = 0; i < n; i++) if (JSON.stringify(a.ok[k][i]) !== JSON.stringify(b.ok[k][i])) { d.i = i; d.off = a.ok[k][i] ?? null; d.on = b.ok[k][i] ?? null; break; }
            d.lenOff = a.ok[k].length; d.lenOn = b.ok[k].length;
        }
        out.push(d);
    }
    return out;
};
const rows = [];
const movers = [];
for (const p of files) {
    let tape;
    try { tape = JSON.parse(readFileSync(p, 'utf8')); } catch { continue; }
    if (!tape?.inputs || !tape?.boot) continue;
    const name = relative(ROOT, p);
    const off = go(tape, offArm);
    const on = go(tape, onArm);
    const diff = fieldDiff(off, on);
    const hitsOff = off.ok?.hits ?? null; const hitsOn = on.ok?.hits ?? null;
    rows.push({ tape: name, moved: diff.length > 0, offThrows: off.throw ?? null, hitsOff, hitsOn, diff });
    if (diff.length) { movers.push(name); console.log(`${name}: ${diff.map((d) => d.field + (d.i !== undefined ? `[${d.i}]` : '')).join(', ')}`); }
}
console.log(`tapes ${rows.length}; ON movers ${movers.length}`);
const jo = arg('json', null);
if (jo) writeFileSync(jo, `${JSON.stringify({ tapes: rows.length, keys: KEYS, base: BASE, over: OVER, movers, rows: rows.filter((r) => r.moved || r.offThrows) }, null, 1)}\n`);
