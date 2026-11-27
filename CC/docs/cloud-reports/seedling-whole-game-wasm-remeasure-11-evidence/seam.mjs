// MEASUREMENT-ONLY: print staging.seam.time of captured requests: node seam.mjs <file> <id:i>...
import { readFileSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
const { restoreRequest } = await import('/home/user/Archipelago-CC/scripts/procgen/seedlingSolveRequestCodec.js');
const [f, ...ids] = process.argv.slice(2);
const raw = f.endsWith('.gz') ? gunzipSync(readFileSync(f)).toString() : readFileSync(f, 'utf8');
const rows = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l));
for (const w of ids) { const [id, i] = w.split(':'); const r = rows.find((x) => String(x.id) === id); const q = r?.requests[Number(i)];
  if (!q) { console.log(w, 'absent'); continue; } const t = restoreRequest(q.request);
  console.log(`${w} goal=${q.goal} seam.time=${t.staging?.seam?.time} perTick=${t.perTick?.length} ans=${q.result?.answer} ok=${q.result?.ok}`); }
