// MEASUREMENT-ONLY: solve a captured request; dump plan keys, rows near a window, tick-by-tick positions/hits.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const ROOT = '/home/user/Archipelago-CC';
const [file, id, i] = process.argv.slice(2);
const raw = gunzipSync(readFileSync(file)).toString();
const row = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const cap = row.requests[Number(i)].request;
if (process.env.SEAM_SHIFT) cap.staging.seam.time += Number(process.env.SEAM_SHIFT);
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${ROOT}/frontend/modules/seedlingDemo/atlasSource.js`);
const { solveAnytime, ANYTIME_PASSES } = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const { createRunForStaging } = await import(`${ROOT}/frontend/modules/seedlingDemo/tapeRunner.js`);
const req = restoreRequest(cap);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const a = solveAnytime({ ...tape, source, levelSource }, { passes });
console.log('ok', a.ok, 'ticks', a.plan?.solution?.length, 'prefix', tape.perTick.length, 'planKeys', Object.keys(a.plan ?? {}).join(','));
const [from, to] = (process.env.WIN ?? '1660,1700').split(',').map(Number);
const tr = a.plan?.trace ?? a.plan?.rows ?? a.trace;
if (Array.isArray(tr)) for (const r of tr) if (r.tick >= from - 60 && r.tick <= to) console.log('ROW', r.tick, JSON.stringify(r.strategy ?? r.verb ?? '').slice(0, 300), String(r.saw ?? '').slice(0, 100), JSON.stringify(r.goal ?? '').slice(0, 120));
if (!a.ok) { console.log(String(a.message).slice(0, 1500)); process.exit(0); }
const eq = new Map(tape.equips ?? []);
for (const [t, s] of a.plan.equipsAt ?? []) eq.set(tape.perTick.length + t, s);
const keys = [...tape.perTick, ...a.plan.solution];
const r = createRunForStaging(tape.staging, levelSource);
let nh = 0;
keys.forEach((h, k) => { const s = eq.get(k); if (s !== undefined) r.equipNow(s); r.advance(h);
  const hs = r.ledger('playerHits'); const hit = hs.length > nh ? hs.slice(nh).map((x) => `HIT t${x.t} ${x.source}:${x.id}`).join(' ') : '';
  nh = hs.length;
  if (hit) (globalThis.__HITK ??= []).push([k, hit]);
  if ((k >= from && k <= to) || hit) console.log('K', k, r.state.x.toFixed(2), r.state.y.toFixed(2), 'v', r.state.vx.toFixed(2), r.state.vy.toFixed(2), [...h].join('+'), hit); });
const segs = globalThis.__SEG ?? [];
console.log('SEGS', segs.length);
const last = segs.filter((o) => o?.trace?.rows).map((o) => o.trace.rows);
const lo = Number(process.env.ROWLO ?? from - 120), hi = Number(process.env.ROWHI ?? to + 40);
last.forEach((rows, si) => { for (const r of rows) if (r.tick >= lo && r.tick <= hi) console.log('SEG', si, 'ROW', r.tick, JSON.stringify(r.strategy ?? null).slice(0, 260), '|', JSON.stringify(r.goal ?? null).slice(0, 100), '|', JSON.stringify(r.rejected ?? null).slice(0, 200), '| keys', (r.keys ?? []).length); });

for (const [k, hit] of globalThis.__HITK ?? []) for (const [si, rows] of last.entries()) {
  const own = rows.filter((r) => r.tick <= k).at(-1);
  console.log('OWNER seg', si, 'key', k, hit, '<-', own?.tick, JSON.stringify(own?.strategy ?? null).slice(0, 200), String(own?.goal?.kind ?? ''));
}
const KT = globalThis.__KT ?? [];
const want = new Set((process.env.KT ?? '').split(',').filter(Boolean).map(Number));
for (const [k] of globalThis.__HITK ?? []) for (let d = -10; d <= 1; d += 1) want.add(k + d);
const seen = new Set();
for (const x of KT) if (want.has(x.k)) { const s = JSON.stringify(x); if (!seen.has(s)) { seen.add(s); console.log('KT', s.slice(0, 400)); } }
