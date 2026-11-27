#!/usr/bin/env node
// wave 69 (DEADFRAME2): every committed tape's `runTape` result, one sha1 per top-level field (and the throw), for
// diffing two SOURCE states (the 149-clock census: `census2-scratch.py apply --clock149` against the shipped file).
//   node tape-dump.mjs --out=a.json [--over='{"k":true}']      then      node tape-dump.mjs --diff=a.json,b.json
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
const DIFF = arg('diff', null);
if (DIFF) {
    const [a, b] = DIFF.split(',').map((f) => JSON.parse(readFileSync(f, 'utf8')));
    const movers = [];
    for (const k of Object.keys(a)) {
        const fa = a[k]; const fb = b[k] ?? {};
        const moved = [...new Set([...Object.keys(fa), ...Object.keys(fb)])].filter((f) => fa[f] !== fb[f]);
        if (moved.length) { movers.push(k); console.log(`${k}: ${moved.join(', ')}`); }
    }
    console.log(`tapes ${Object.keys(a).length}; movers ${movers.length}`);
    process.exit(0);
}
const { atlasLevelSource } = await import(`${ROOT}frontend/modules/seedlingDemo/levelSource.js`);
const { runTape } = await import(`${ROOT}frontend/modules/seedlingDemo/tapeRunner.js`);
const { withContactFidelity } = await import(`${ROOT}frontend/modules/seedlingDemo/contactFidelity.js`);
const OVER = JSON.parse(arg('over', '{}'));
const FIX = join(ROOT, 'frontend/modules/seedlingDemo/fixtures');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = [...readdirSync(join(FIX, 'tapes')).filter((f) => f.endsWith('.json')).map((f) => join(FIX, 'tapes', f)),
    ...walk(FIX).filter((p) => p.endsWith('.tape.json'))].sort();
const h = (v) => createHash('sha1').update(JSON.stringify(v) ?? 'undefined').digest('hex').slice(0, 12);
const out = {};
for (const p of files) {
    let tape;
    try { tape = JSON.parse(readFileSync(p, 'utf8')); } catch { continue; }
    if (!tape?.inputs || !tape?.boot) continue;
    const r = withContactFidelity(OVER, () => { try { return { ok: runTape(tape, { levelSource: atlasLevelSource() }) }; } catch (e) { return { throw: `${e?.name}: ${String(e?.message ?? e).slice(0, 200)}` }; } });
    out[relative(ROOT, p)] = r.throw ? { THROW: h(r.throw) } : Object.fromEntries(Object.entries(r.ok).map(([k, v]) => [k, h(v)]));
}
writeFileSync(arg('out', '/dev/stdout'), `${JSON.stringify(out, null, 1)}\n`);
