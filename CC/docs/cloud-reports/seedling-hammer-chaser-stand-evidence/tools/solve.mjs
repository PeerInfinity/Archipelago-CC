// MEASUREMENT-ONLY (stack4-measure): solve ONE page request node-side as the worker does; print one JSON line.
//   node --import ./seg-reg.mjs solve.mjs fx <fixture.json[.gz]|.jsonl[.gz]> [<id> <i>]
//   node --import ./seg-reg.mjs solve.mjs cap <capture.jsonl> <id> <i>
// env: SEAM_SHIFT=<n> adds n to staging.seam.time; VARIANT=<label> is echoed. Switches come from SEEDLING_* env.
// Hits: each one's tick, owner row (the last verb row of the final ok pass at or before the hit's key) and verb.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const ROOT = '/home/user/Archipelago-CC';
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${ROOT}/frontend/modules/seedlingDemo/atlasSource.js`);
const { solveAnytime, replayTape, ANYTIME_PASSES } = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const { atlasLevelSource } = await import(`${ROOT}/frontend/modules/seedlingDemo/levelSource.js`);
const sb = await import(`${ROOT}/frontend/modules/seedlingDemo/solverBot.js`);
const [mode, file, id, i] = process.argv.slice(2);
const buf = readFileSync(file);
const text0 = (file.endsWith('.gz') ? gunzipSync(buf) : buf).toString();
let cap, key = null;
if (mode === 'cap' || id !== undefined) {
  const row = text0.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === String(id));
  cap = row.requests.find((r) => String(r.i) === String(i)).request; key = row.key ?? null;
} else {
  const raw = JSON.parse(text0.trim().split('\n')[0]);
  cap = raw.requests ? raw.requests[0].request : (raw.request ?? raw); key = raw.key ?? raw.requests?.[0]?.key ?? null;
}
const shift = Number(process.env.SEAM_SHIFT ?? 0);
if (shift) cap.staging.seam.time += shift;
const req = restoreRequest(cap);
const { passes: passes0 = ANYTIME_PASSES, source, ...tape } = req; const passes = process.env.ONLY_PASS ? passes0.filter((p) => p.pass === process.env.ONLY_PASS) : passes0;
const levelSource = source ? levelSourceFromAtlas(source.records) : atlasLevelSource();
const t0 = Date.now();
const a = solveAnytime({ ...tape, ...(source ? { source } : {}), levelSource }, { passes });
const text = a.ok ? JSON.stringify(a.plan.solution.map((k) => [...k])) : String(a.message ?? '');
let hits = null, deaths = null;
if (a.ok) {
  const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
  const h0 = run.playerHits.length, d0 = run.playerDeaths.length, P = tape.perTick.length;
  const rowsets = (globalThis.__SEG ?? []).filter((o) => o?.trace?.rows).map((o) => o.trace.rows);
  const rows = rowsets.at(-1) ?? [];
  hits = [];
  a.plan.solution.forEach((h, k) => {
    const s = a.plan.equipsAt?.get?.(k); if (s !== undefined) run.equipNow(s);
    const n = run.playerHits.length; run.advance(h);
    if (process.env.DUMP_KEYS) { const [lo, hi] = process.env.DUMP_KEYS.split(',').map(Number); if (P + k >= lo && P + k <= hi) {
      const ch = ['chasers', 'spinnerBodies', 'bombs'].map((n) => `${n}=` + (run.entities(n) ?? []).map((e) => `${e.id}(${(+e.x).toFixed(0)},${(+e.y).toFixed(0)})`).join(' ')).join(' | ');
      console.error('K', P + k, run.state.x.toFixed(1), run.state.y.toFixed(1), [...h].join('+'), ch); } }
    for (const x of run.playerHits.slice(n)) {
      const own = rows.filter((r) => r.tick <= P + k).at(-1);
      const st = own?.strategy; const verb = st?.verb ?? st?.kind ?? (typeof st === 'string' ? st : null);
      hits.push(`t${x.t} ${x.source}:${x.id} <- row${own?.tick ?? '?'} ${verb ?? JSON.stringify(st ?? null).slice(0, 40)}`);
    }
  });
  deaths = run.playerDeaths.length - d0;
  if (process.env.DUMP_KT) { const [lo, hi] = process.env.DUMP_KT.split(',').map(Number); const seen = new Set();
    for (const x of globalThis.__KT ?? []) if (x.k >= lo && x.k <= hi) { const s = JSON.stringify(x); if (!seen.has(s)) { seen.add(s); console.error('KT', s.slice(0, 300)); } } }
  if (process.env.DUMP_CS) { const [lo, hi] = process.env.DUMP_CS.split(",").map(Number); for (const x of globalThis.__CS ?? []) if (x.k >= lo && x.k <= hi) console.error("CS", JSON.stringify(x)); }
  if (process.env.DUMP_ROWS) {
    const [lo, hi] = process.env.DUMP_ROWS.split(',').map(Number);
    rowsets.forEach((rs, si) => { for (const r of rs) if (r.tick >= lo && r.tick <= hi) console.error('SEG', si, 'ROW', r.tick, JSON.stringify(r.strategy ?? null).slice(0, 300), '|', JSON.stringify(r.goal ?? null).slice(0, 120), '|', String(r.saw ?? '').slice(0, 200)); });
  }
}
console.log(JSON.stringify({ src: file.split('/').pop() + (id !== undefined ? `#${id}:${i}` : ''), key, seam: shift, variant: process.env.VARIANT ?? null,
  ok: a.ok, work: a.work, ticks: a.plan?.solution?.length ?? null, answer: createHash('sha1').update(text).digest('hex').slice(0, 12),
  hits, deaths, ms: Date.now() - t0,
  reach: { pksw: sb.PRESS_KILL_START_WAIT_COUNTS.rows.length, pkrb: { ...sb.PRESS_KILL_REFUGE_BOMBS_COUNTS }, dss: { ...sb.DASH_STAND_SIGHT.counts },
    oac: sb.OPP_AIM_CHASERS_COUNTS ? { ...sb.OPP_AIM_CHASERS_COUNTS } : null, lhm: { asked: sb.LATCHED_HOLD_MOVE_COUNTS.asked, moves: sb.LATCHED_HOLD_MOVE_COUNTS.moves.length, declined: sb.LATCHED_HOLD_MOVE_COUNTS.declined.length } },
  passes: (a.passes ?? []).map((p) => [p.pass, p.ok ? p.ticks : (p.kind ?? "x"), p.work, p.modelHits ? p.modelHits.hits : null, p.cut ?? p.deadline ?? null, p.tries ?? null].join(":")),
  msg: a.ok ? null : text.slice(0, Number(process.env.MSGLEN ?? 220)) }));
