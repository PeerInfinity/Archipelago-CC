// scratch (BOBIFRAME D2): one captured request at one arrival clock — solve with chaserSpinnerWalls OFF and ON (the
// worker's dispatch), then replay each plan on the ON model (the game's, by the four recordings) and count player hits.
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = '/home/user/Archipelago-CC';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(ROOT + '/frontend/modules/seedlingDemo/atlasSource.js');
const JR = await import(ROOT + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { withContactFidelity } = await import(ROOT + '/frontend/modules/seedlingDemo/contactFidelity.js');
let c0;
for (const line of readFileSync(args.requests, 'utf8').trim().split('\n')) {
  const row = JSON.parse(line); if (String(row.id) !== args.id) continue;
  c0 = row.requests.find((c) => String(c.i) === (args.i ?? '1')).request;
}
const seam = Number(args.seam);
const mk = () => restoreRequest({ ...c0, staging: { ...c0.staging, seam: { ...c0.staging.seam, time: seam } } });
const out = { id: args.id, seam };
for (const walls of [false, true]) {
  const { passes: P0 = JR.ANYTIME_PASSES, source, ...tape } = mk();
  const t0 = Date.now();
  const ans = withContactFidelity({ chaserSpinnerWalls: walls }, () => JR.solveAnytime({ ...tape, levelSource: levelSourceFromAtlas(source.records) }, { passes: P0 }));
  const row = { ok: ans.ok, ms: Date.now() - t0, work: ans.work ?? null, passes: (ans.passes ?? []).map((p) => `${p.pass}:${p.ok ? p.ticks : (p.kind ?? 'no')}${p.deadline ? '@' + p.deadline : ''}`) };
  if (ans.ok) {
    row.ticks = ans.plan.solution.length; row.verbs = ans.plan.verbs;
    const hitsOn = withContactFidelity({ chaserSpinnerWalls: true }, () => {
      const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records), scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
      for (let k = 0; k < ans.plan.solution.length; k += 1) { const slot = ans.plan.equipsAt?.get?.(k); if (slot !== undefined) run.equipNow(slot); run.advance(ans.plan.solution[k]); }
      return run.playerHits.map((h) => `${h.t}:${h.id}`);
    });
    row.hitsOnGameModel = hitsOn;
  } else row.message = String(ans.message ?? '').slice(0, 260);
  out[walls ? 'on' : 'off'] = row;
}
console.log(JSON.stringify(out));
