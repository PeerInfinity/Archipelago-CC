// NEEDS the producer wiring (../producer-wiring.patch applied): it reads `playthroughArrivalGuards`.
// Every level's K guards and T discs as the producer stamps them.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
const P = await import(pathToFileURL(path.join(repo, 'scripts/procgen/make-seedling-playthrough-rules.mjs')));
for (const l of P.PLAYTHROUGH_MAP.levels) P.playthroughGridFor(l);
for (const [n, r] of [...P.playthroughArrivalGuards].sort((a, b) => a[0] - b[0])) {
  for (const g of r.guards) console.log(`L${n} K ${g.body} speed ${g.speed} leash ${g.runRange}: zone ${g.zone}, cut ${g.cut.length}: ${g.cut.map((c) => c.join(',')).join(' ')}`);
  for (const t of r.traps) console.log(`L${n} T lavatrap tile ${t.trap}: ${t.cells.length} cells ${t.cells.map((c) => c.join(',')).join(' ')}`);
}
