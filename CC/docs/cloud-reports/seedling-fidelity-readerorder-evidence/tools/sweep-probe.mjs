#!/usr/bin/env node
// The planner's SWEEP CENSUS (wave 64): which committed tapes make a reader query whose answer would CHANGE if the
// reader read the open set "before this frame's responder update" (`openActivatorIdsBeforeStep`) instead of the
// shipped read. Needs `scratch.py apply` (the probe E2/E3); it runs the SHIPPED arm (`__RO.arm` unset), so the probe
// only observes. A hit is one `collides` query (a 1 px sub-step of a block's, a spinner's or a wallflyer's sweep)
// whose truthiness differs between the two sets: `{reader, level, t}`; `shipped` is the shipped answer (true = Solid).
// Over: every `fixtures/tapes/*.json` and every `fixtures/**/*.tape.json` (the committed tapes), plus `--dir=<path>`
// (e.g. a route survey's `views/`, which is a regenerable cache and is not committed).
// usage: node sweep-probe.mjs [--dir=…] [--json=out.json]
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const { atlasLevelSource } = await import(`${ROOT}frontend/modules/seedlingDemo/levelSource.js`);
const { runTape } = await import(`${ROOT}frontend/modules/seedlingDemo/tapeRunner.js`);
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
const FIX = join(ROOT, 'frontend/modules/seedlingDemo/fixtures');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = [...readdirSync(join(FIX, 'tapes')).filter((f) => f.endsWith('.json')).map((f) => join(FIX, 'tapes', f)),
    ...walk(FIX).filter((p) => p.endsWith('.tape.json'))];
const extra = arg('dir', null);
if (extra) files.push(...walk(extra).filter((p) => /walk\.json$|\.tape\.json$/.test(p)));
globalThis.__RO = { probe: true, hits: [] };
const rows = [];
let throws = 0;
for (const p of files.sort()) {
    const name = relative(ROOT, p);
    let tape;
    try { tape = JSON.parse(readFileSync(p, 'utf8')); } catch { continue; }
    if (!tape?.inputs || !tape?.boot) continue;
    globalThis.__RO.hits = [];
    globalThis.__RO.who = null;
    let err = null;
    try { runTape(tape, { levelSource: atlasLevelSource() }); } catch (e) { err = String(e?.message ?? e).slice(0, 160); throws += 1; }
    const hits = globalThis.__RO.hits;
    const key = (h) => `${h.reader} L${h.level} t${h.t}`;
    const uniq = [...new Map(hits.map((h) => [key(h), h])).values()];
    rows.push({ tape: name, hits: hits.length, ticks: uniq.map((h) => ({ reader: h.reader, level: h.level, t: h.t, shipped: h.shipped })), error: err });
    if (uniq.length) console.log(`HIT ${name}: ${uniq.length} tick(s): ${uniq.slice(0, 8).map(key).join(', ')}${uniq.length > 8 ? ' …' : ''}`);
}
const hit = rows.filter((r) => r.ticks.length);
console.log(`tapes ${rows.length} (throws ${throws}); tapes with a read-differs query: ${hit.length}`);
const byReader = {};
for (const r of hit) for (const t of r.ticks) byReader[t.reader] = (byReader[t.reader] ?? 0) + 1;
console.log(`hit ticks by reader: ${JSON.stringify(byReader)}`);
for (const r of rows.filter((x) => x.error)) console.log(`  threw: ${r.tape}: ${r.error}`);
const jo = arg('json', null);
if (jo) writeFileSync(jo, `${JSON.stringify({ files: rows.length, throws, hit: hit.length, byReader, rows }, null, 1)}\n`);
