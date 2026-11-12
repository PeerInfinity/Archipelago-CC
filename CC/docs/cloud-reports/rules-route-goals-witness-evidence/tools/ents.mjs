// rules-route-goals-witness: list one level's entities from a captured sweep request (`node ents.mjs <capture.jsonl> <leg id> <level> [type regex]`).
// print a level's entities from a captured request (by leg id), filtered by regex
import { readFileSync } from 'node:fs';
const R = (process.env.REPO || process.cwd()) + '/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const [file, id, lvl, re] = process.argv.slice(2);
for (const line of readFileSync(file, 'utf8').trim().split('\n')) {
  const o = JSON.parse(line); if (String(o.id) !== id) continue;
  const req = restoreRequest(o.requests[0].request);
  const rec = req.source.records.get(Number(lvl));
  console.log('staging', JSON.stringify({ ...req.staging, inventory: undefined }).slice(0, 600));
  console.log('size', rec.width, rec.height);
  for (const e of rec.entities) if (!re || new RegExp(re).test(e.type)) console.log(`${e.type}@${e.x},${e.y} (${Math.floor(e.x/16)},${Math.floor(e.y/16)}) ${JSON.stringify(e.attrs ?? {})}`);
  break;
}
