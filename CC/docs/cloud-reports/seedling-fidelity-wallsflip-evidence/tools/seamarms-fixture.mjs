// WALLSFLIP (after BOBIFRAME's seamarms.mjs): a committed captured request (hammer-cleartag-chain fixture) at the SHIPPED
// defaults, over arrival clocks — solve with chaserSpinnerWalls OFF and ON (the worker's dispatch: solveAnytime with the
// request's own passes), then replay each plan on the wall-ON model (the game's) and count player hits.
// usage: seamarms-fixture.mjs <fixture.json.gz> <fromSeam> <toSeam>
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const ROOT = '/home/user/Archipelago-CC';
const M = ROOT + '/frontend/modules/seedlingDemo/';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const JR = await import(M + 'jsRuntimeSolver.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const [fix, from, to] = process.argv.slice(2);
const c0 = JSON.parse(gunzipSync(readFileSync(M + 'fixtures/hammer-cleartag-chain/' + fix)).toString('utf8')).requests[0].request;
for (let seam = Number(from); seam <= Number(to); seam += 1) {
  const mk = () => restoreRequest({ ...c0, staging: { ...c0.staging, seam: { ...c0.staging.seam, time: seam } } });
  const out = { fix: fix.slice(0, 6), seam };
  for (const walls of [false, true]) {
    const { passes: P0 = JR.ANYTIME_PASSES, source, ...tape } = mk();
    const levelSource = levelSourceFromAtlas(source.records);
    const t0 = Date.now();
    const ans = withContactFidelity({ chaserSpinnerWalls: walls }, () => JR.solveAnytime({ ...tape, levelSource }, { passes: P0 }));
    const row = { ok: ans.ok, ms: Date.now() - t0, work: ans.work ?? null, passes: (ans.passes ?? []).map((p) => `${p.pass}:${p.ok ? p.ticks : (p.kind ?? 'no')}${p.deadline ? '@' + p.deadline : ''}`) };
    if (ans.ok) {
      row.ticks = ans.plan.solution.length; row.verbs = ans.plan.verbs;
      row.hitsOnGameModel = withContactFidelity({ chaserSpinnerWalls: true }, () => {
        const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
        for (let k = 0; k < ans.plan.solution.length; k += 1) { const slot = ans.plan.equipsAt?.get?.(k); if (slot !== undefined) run.equipNow(slot); run.advance(ans.plan.solution[k]); }
        return run.playerHits.map((h) => `${h.t}:${h.id}`);
      });
    } else row.message = String(ans.message ?? '').split('\n')[0].slice(0, 330);
    out[walls ? 'on' : 'off'] = row;
  }
  console.log(JSON.stringify(out));
}
