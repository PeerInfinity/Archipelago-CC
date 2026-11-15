import { readFileSync } from 'node:fs'; import { gunzipSync } from 'node:zlib'; import { createHash } from 'node:crypto';
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { restoreRequest } = await import('/home/user/Archipelago-CC/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'atlasSource.js');
const { solveAnytime, replayTape } = await import(R + 'jsRuntimeSolver.js');
const OPF = await import(R + 'oppPressFallback.js'); const OFH = await import(R + 'oppFallbackHits.js');
const c = JSON.parse(gunzipSync(readFileSync(R + 'fixtures/hammer-l40-flip/leg377-l42-l40-request.json.gz')).toString()).requests[0].request;
for (const on of [false, true]) {
  OPF.resetOppPressFallbackCounts(); OFH.resetOppFallbackHitsCounts();
  const { passes, source, ...tape } = restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: 5323 } } });
  const levelSource = levelSourceFromAtlas(source.records);
  const a = OFH.withOppFallbackHits(on, () => solveAnytime({ ...tape, levelSource }, { passes }));
  const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
  const h0 = run.playerHits.length; for (let k = 0; k < a.plan.solution.length; k += 1) { const s = a.plan.equipsAt?.get?.(k); if (s !== undefined) run.equipNow(s); run.advance(a.plan.solution[k]); }
  console.log(JSON.stringify({ on, ok: a.ok, work: a.work, verbs: a.plan.verbs, ticks: a.plan.solution.length, sha: createHash('sha1').update(JSON.stringify(a.plan.solution.map((k) => [...k]))).digest('hex').slice(0, 12), planHits: run.playerHits.length - h0, opf: { ...OPF.OPP_PRESS_FALLBACK_COUNTS }, ofh: OFH.OPP_FALLBACK_HITS_COUNTS }));
}
