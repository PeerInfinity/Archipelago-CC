#!/usr/bin/env node
// DEADFRAME D3: the runtime probe (needs `probe-scratch.py apply <repo>`): every committed tape with both keys ON (and
// `--over=` keys), the counters per tape and in total. usage: node probe-deadframe.mjs <repo> [--over='{…}'] [--json=out]
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const ROOT = process.argv[2].replace(/\/?$/, '/');
const { atlasLevelSource } = await import(`${ROOT}frontend/modules/seedlingDemo/levelSource.js`);
const { runTape } = await import(`${ROOT}frontend/modules/seedlingDemo/tapeRunner.js`);
const { withContactFidelity } = await import(`${ROOT}frontend/modules/seedlingDemo/contactFidelity.js`);
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
const OVER = JSON.parse(arg('over', '{}'));
const FIX = join(ROOT, 'frontend/modules/seedlingDemo/fixtures');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = [...readdirSync(join(FIX, 'tapes')).filter((f) => f.endsWith('.json')).map((f) => join(FIX, 'tapes', f)),
    ...walk(FIX).filter((p) => p.endsWith('.tape.json'))].sort();
const total = {}; const rows = []; let n = 0;
for (const p of files) {
    let tape; try { tape = JSON.parse(readFileSync(p, 'utf8')); } catch { continue; }
    if (!tape?.inputs || !tape?.boot) continue;
    n += 1; globalThis.__DFP = { c: {} };
    try { withContactFidelity({ deadFrameResponderStep: true, enemyPressesFallRockButton: true, ...OVER }, () => runTape(tape, { levelSource: atlasLevelSource() })); } catch { globalThis.__DFP.c.threw = 1; }
    const c = globalThis.__DFP.c;
    for (const [k, v] of Object.entries(c)) total[k] = (total[k] ?? 0) + v;
    if (c.queued) rows.push({ tape: relative(ROOT, p), ...c });
}
delete globalThis.__DFP;
console.log(`tapes ${n}; over ${JSON.stringify(OVER)}; totals ${JSON.stringify(total)}`);
for (const r of rows) console.log(`  ${r.tape}: ${JSON.stringify({ ...r, tape: undefined })}`);
const jo = arg('json', null);
if (jo) writeFileSync(jo, `${JSON.stringify({ tapes: n, over: OVER, total, rows }, null, 1)}\n`);
