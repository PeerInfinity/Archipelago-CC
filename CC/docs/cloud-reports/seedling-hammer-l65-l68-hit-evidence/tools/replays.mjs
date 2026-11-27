// replay every captured request of the given files OFF vs ON (WALK_BLADE_ARM), both wand keys + swap ON (env).
import { readFileSync, appendFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const R = '/home/user/Archipelago-CC/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const J = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { withWalkBladeArm, WALK_BLADE_ARM_COUNTS, resetWalkBladeArmCounts } = await import(R + 'frontend/modules/seedlingDemo/walkBladeArm.js');
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
const [out, shard, nshard, ...files] = process.argv.slice(2);
let k = 0;
for (const f of files) {
  const legs = gunzipSync(readFileSync(f)).toString('utf8').trim().split('\n').map((l) => JSON.parse(l));
  for (const leg of legs) for (const rq of leg.requests) {
    if ((k++ % Number(nshard)) !== Number(shard)) continue;
    const { passes = J.ANYTIME_PASSES, source, ...tape } = restoreRequest(rq.request);
    const levelSource = levelSourceFromAtlas(source.records);
    const row = { file: f.split('/').pop(), leg: leg.id, i: rq.i, goal: rq.goal };
    for (const on of [false, true]) {
      resetWalkBladeArmCounts();
      let a;
      try { a = withWalkBladeArm(on, () => J.solveAnytime({ ...tape, source, levelSource }, { passes })); } catch (e) { a = { ok: false, kind: 'throw', message: String(e.message), passes: [] }; }
      let hits = null;
      if (a.ok) { try { const run = J.replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...a.plan.solution], levelSource,
        equips: new Map([...(tape.equips ?? new Map()), ...[...a.plan.equipsAt].map(([t, s]) => [t + tape.perTick.length, s])]), scratchPersistence: tape.scratchPersistence === true, holds: tape.holds ?? null });
        hits = run.ledger('playerHits').filter((h) => h.t > tape.perTick.length).length + run.ledger('playerDeaths').filter((h) => h.t > tape.perTick.length).length; } catch (e) { hits = 'replay-throw'; } }
      row[on ? 'on' : 'off'] = { ok: a.ok, kind: a.kind ?? null, ticks: a.ok ? a.plan.solution.length : null, work: a.work ?? null,
        answer: sha(a.ok ? JSON.stringify(a.plan.solution.map((x) => [...x])) : String(a.message ?? '')), hits, equips: on ? WALK_BLADE_ARM_COUNTS.equips : undefined };
    }
    appendFileSync(out, JSON.stringify(row) + '\n');
  }
}
