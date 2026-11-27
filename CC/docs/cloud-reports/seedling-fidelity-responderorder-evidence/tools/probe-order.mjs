#!/usr/bin/env node
// RESPONDERORDER's runtime probe (needs `probe-scratch.py apply`): every committed tape under ON, the counters per
// tape and in total. usage: node probe-order.mjs [--json=out.json]
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const { atlasLevelSource } = await import(`${ROOT}frontend/modules/seedlingDemo/levelSource.js`);
const { runTape } = await import(`${ROOT}frontend/modules/seedlingDemo/tapeRunner.js`);
const { withContactFidelity } = await import(`${ROOT}frontend/modules/seedlingDemo/contactFidelity.js`);
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
const FIX = join(ROOT, 'frontend/modules/seedlingDemo/fixtures');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = [...readdirSync(join(FIX, 'tapes')).filter((f) => f.endsWith('.json')).map((f) => join(FIX, 'tapes', f)),
    ...walk(FIX).filter((p) => p.endsWith('.tape.json'))].sort();
const total = {};
const rows = [];
for (const p of files) {
    let tape;
    try { tape = JSON.parse(readFileSync(p, 'utf8')); } catch { continue; }
    if (!tape?.inputs || !tape?.boot) continue;
    globalThis.__RP = { c: {} };
    try { withContactFidelity({ responderStepAfterReaders: true }, () => runTape(tape, { levelSource: atlasLevelSource() })); } catch { globalThis.__RP.c.threw = 1; }
    if (globalThis.__RP.pending?.()) globalThis.__RP.c.tapeEndPending = 1;
    const c = globalThis.__RP.c;
    for (const [k, v] of Object.entries(c)) total[k] = (total[k] ?? 0) + v;
    if (c.enemyPress || c.enemyHold || c.staleDrop) rows.push({ tape: relative(ROOT, p), ...c });
}
delete globalThis.__RP;
console.log(`tapes ${files.length}; totals ${JSON.stringify(total)}`);
for (const r of rows) console.log(`  ${r.tape}: ${JSON.stringify({ enemyPress: r.enemyPress ?? 0, enemyHold: r.enemyHold ?? 0, staleDrop: r.staleDrop ?? 0 })}`);
const jo = arg('json', null);
if (jo) writeFileSync(jo, `${JSON.stringify({ total, rows }, null, 1)}\n`);
