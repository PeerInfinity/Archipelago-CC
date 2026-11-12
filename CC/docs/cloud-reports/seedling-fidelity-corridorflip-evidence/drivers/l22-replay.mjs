// node replay.mjs <request.json> [variant]   — a captured L22 request solved as the worker does (jsRuntimeSolveWorker:
// levelSourceFromAtlas(source.records) → solveAnytime({...tape, levelSource}, {passes})). variant mutates the request.
import { readFileSync } from 'node:fs';
const WT = '/home/user/Archipelago-CC';
const { restoreRequest } = await import(`${WT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${WT}/frontend/modules/seedlingDemo/atlasSource.js`);
const { solveAnytime, ANYTIME_PASSES, replayTape } = await import(`${WT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const [file, variant = 'as-captured'] = process.argv.slice(2);
const cap = JSON.parse(readFileSync(file, 'utf8'));
const req = restoreRequest(cap.request ?? cap);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const mut = (await import('./variants.mjs')).default[variant];
if (!mut) throw new Error(`no variant ${variant}`);
mut(tape);
const { loadAtlas } = await import(`${WT}/frontend/modules/seedlingDemo/levelSource.js`);
const { patchedMapDocument } = await import(`${WT}/frontend/modules/seedlingDemo/seedlingSetPatches.js`);
const { indexLevels } = await import(`${WT}/frontend/modules/seedlingDemo/atlasSource.js`);
const RECS = process.env.RECORDS || (source.records instanceof Map && source.records.size ? "captured" : "patched");
if (!(source.records instanceof Map) || source.records.size === 0) source.records = indexLevels(RECS === 'raw' ? loadAtlas() : patchedMapDocument(loadAtlas()));
const levelSource = levelSourceFromAtlas(source.records);
const t0 = Date.now();
const a = solveAnytime({ ...tape, source, levelSource }, { passes });
const out = { variant, records: RECS, ok: a.ok, kind: a.kind ?? null, ms: Date.now() - t0, work: a.work ?? null,
  passes: (a.passes ?? []).map(({ ms, ...r }) => r) };
if (a.ok) {
  out.ticks = a.plan.solution.length; out.verbs = a.plan.verbs;
  try {
  const fresh = replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...a.plan.solution], levelSource,
    scratchPersistence: tape.scratchPersistence, equips: tape.equips });
  Object.assign(out, { ticks: a.plan.solution.length, verbs: a.plan.verbs, level: fresh.level,
    hits: fresh.ledger('playerHits').map((h) => [h.t, h.source, h.id]), deaths: fresh.ledger('playerDeaths').length });
  } catch (e) { out.replayError = String(e.message).slice(0, 300); }
} else out.message = String(a.message ?? '');
console.log(JSON.stringify(out, null, 1));
