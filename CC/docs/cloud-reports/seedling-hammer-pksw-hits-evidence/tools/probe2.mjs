// MEASUREMENT-ONLY: replay a captured request's prefix + a dumped plan to key K, then ask the lobber forecast for a stand.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const ROOT = '/home/user/Archipelago-CC';
const [file, id, i, planFile] = process.argv.slice(2);
const raw = gunzipSync(readFileSync(file)).toString();
const row = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const cap = row.requests[Number(i)].request;
if (process.env.SEAM_SHIFT) cap.staging.seam.time += Number(process.env.SEAM_SHIFT);
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${ROOT}/frontend/modules/seedlingDemo/atlasSource.js`);
const { createRunForStaging } = await import(`${ROOT}/frontend/modules/seedlingDemo/tapeRunner.js`);
const req = restoreRequest(cap);
const { source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const plan = JSON.parse(readFileSync(planFile, 'utf8'));
const keys = [...tape.perTick, ...plan.solution.map((k) => new Set(k))];
const eq = new Map(tape.equips ?? []);
const Ks = process.env.KS.split(',').map(Number);
const r = createRunForStaging(tape.staging, levelSource);
for (let k = 0; k <= Math.max(...Ks); k += 1) {
  if (Ks.includes(k)) {
    const f = r.spitForecast?.() ?? null;
    const bombs = (r.entities('bombs') ?? []).filter((b) => !b.removed).map((b) => `${b.id}@${b.x?.toFixed?.(1)},${b.y?.toFixed?.(1)}`);
    const out = [];
    if (f) for (let s = 0; s < 31; s += 1) for (const b of f.step({ x: r.state.x, y: r.state.y })) if (b.kind === 'bomb') out.push(`s${s}:${b.id}:${b.hitsPlayer ? 'HIT' : 'miss'}@${b.x?.toFixed?.(0)},${b.y?.toFixed?.(0)}`);
    console.log('K', k, 'pos', r.state.x.toFixed(2), r.state.y.toFixed(2), 'tc', r.ticksCompleted, 'forecast', f ? 'yes' : 'null', 'bombs', bombs.join(' '), '|', out.join(' '));
  }
  const s = eq.get(k); if (s !== undefined) r.equipNow(s);
  r.advance(keys[k]);
}
