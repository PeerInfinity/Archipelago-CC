// NEEDS ../producer-hook.patch applied. Every level's K bodies with each candidate's cut (K, b, c, bc, bcr, r), the
// measured speeds and every cell's (c) / race verdict. Usage: K_NARROW=K K_NARROW_REPORT=1 node narrowReport.mjs <out.json>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
const P = await import(pathToFileURL(path.join(repo, 'scripts/procgen/make-seedling-playthrough-rules.mjs')));
const rows = [];
for (const l of P.PLAYTHROUGH_MAP.levels) {
  globalThis.__kNarrowReport = [];
  P.playthroughGridFor(l);
  for (const r of globalThis.__kNarrowReport) rows.push({ level: l.level, ...r });
}
// a level's grid may be built more than once; keep one row per level+body
const seen = new Set();
const uniq = rows.filter((r) => { const k = `${r.level}|${r.body}`; if (seen.has(k)) return false; seen.add(k); return true; });
fs.writeFileSync(process.argv[2], JSON.stringify(uniq, null, 1));
for (const r of uniq) {
  const n = (k) => String(r.cut[k].length).padStart(2);
  console.log(`L${r.level} ${r.body.padEnd(22)} faster-on ${JSON.stringify(r.faster).padEnd(8)} K ${n('K')} b ${n('b')} c ${n('c')} bc ${n('bc')} bcr ${n('bcr')} r ${n('r')} bcR ${n('bcR')} bR ${n('bR')} R ${n('R')}  speeds ${JSON.stringify(r.speeds)}`);
}
