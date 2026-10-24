// scratch: exhaustive short input search on a staged arrival; reports hitless sequences that change level
import { join } from 'node:path';
const D = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo';
const { parseTape } = await import(join(D, 'tapeFormat.js'));
const { createRunForStaging, stagingFromTape } = await import(join(D, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(D, 'levelSource.js'));
const { readFileSync } = await import('node:fs');
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const DEPTH = Number(process.argv[3] ?? 4);
const st0 = stagingFromTape(tape); const st = process.env.SLOTS ? { ...st0, inventory_slots: JSON.parse(process.env.SLOTS), seam: { ...st0.seam, items: { ...st0.seam.items, hitsMax: 3 }, primary: 0 } } : st0; console.log(JSON.stringify(st.seam), st.inventory_slots);
const SRC = atlasLevelSource();
const L0 = tape.boot.level;
const DIRS = [[], ['up'], ['down'], ['left'], ['right'], ['up', 'left'], ['up', 'right'], ['down', 'left'], ['down', 'right'],
  ...(process.env.WITH_SECONDARY ? [['secondary'], ['up', 'secondary'], ['right', 'secondary'], ['down', 'secondary'], ['left', 'secondary'], ['up', 'left', 'secondary'], ['primary', 'secondary']] : []), ...(process.env.WITH_PRIMARY ? [['primary'], ['up', 'primary'], ['right', 'primary'], ['down', 'primary'], ['left', 'primary']] : [])];
let tried = 0; const found = []; let hitAll = 0;
function rec(prefix) {
  if (prefix.length === DEPTH) return;
  for (const k of DIRS) {
    const seq = [...prefix, k];
    const run = createRunForStaging(st, SRC);
    let tr = false;
    for (const h of seq) { const r = run.advance(new Set(h)); if (r.transition || run.level !== L0) { tr = true; break; } }
    tried++;
    const hits = run.playerHits.length;
    if (hits) { hitAll++; continue; }
    if (tr) { found.push(seq.map((h) => h.join('+') || '·').join(' ')); continue; }
    rec(seq);
  }
}
rec([]);
console.log(`tried ${tried}, pruned-by-hit ${hitAll}, hitless crossings ${found.length}`, found.slice(0, 20));
