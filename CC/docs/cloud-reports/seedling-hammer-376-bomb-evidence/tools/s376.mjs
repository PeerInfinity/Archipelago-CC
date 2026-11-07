// scratch: leg 376 (fixture request, committed atlas) at a staged seam; solve with an optional cap; replay fresh.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const R = '/home/user/Archipelago-CC';
const { restoreRequest } = await import(R + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(R + '/scripts/procgen/replay-seedling-solve-request.mjs');
const { atlasLevelSource } = await import(R + '/frontend/modules/seedlingDemo/levelSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(R + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { createRunForStaging } = await import(R + '/frontend/modules/seedlingDemo/tapeRunner.js');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const w = JSON.parse(gunzipSync(readFileSync(args.fix ?? `${process.env.SCRATCH}/leg376-play.json.gz`)).toString());
const seam = Number(args.seam ?? w.seam);
const req = restoreRequest(atSeamTime(w.request, seam));
const { passes = ANYTIME_PASSES, budgetWork, upgradeWindowWork, ...tape } = req;
const levelSource = atlasLevelSource();
const cap = args.cap ? Number(args.cap) : budgetWork;
const t0 = Date.now();
const a = solveAnytime({ ...tape, levelSource, budgetWork: cap, upgradeWindowWork: args.cap ? cap : upgradeWindowWork }, { passes });
const out = { seam, cap, reqBudget: budgetWork, ok: a.ok, work: a.work, ms: Date.now() - t0,
  passes: (a.passes ?? []).map((p) => `${p.pass}:${p.ok}:${p.work}${p.deadline ? '/' + p.deadline : ''}`).join(',') };
if (a.ok) {
  const run = createRunForStaging(tape.staging, levelSource, { scratchPersistence: tape.scratchPersistence === true });
  for (const k of a.plan.solution) run.advance(k);
  out.ticks = a.plan.solution.length; out.pass = a.plan.pass; out.verbs = a.plan.verbs;
  out.hits = run.playerHits.map((h) => `${h.t}:${h.source}:${h.id}`);
  out.dead = run.dead ?? run.player?.dead;
} else out.msg = String(a.message ?? '');
if (args.full) console.log(JSON.stringify(a.passes?.map((p) => ({ ...p, plan: undefined })), null, 1).slice(0, 20000));
if (args.counts) { const SB = await import(R + '/frontend/modules/seedlingDemo/solverBot.js'); out.bpw = SB.BOMB_PHASE_WAIT_COUNTS ? { enabled: SB.BOMB_PHASE_WAIT.enabled, ...SB.BOMB_PHASE_WAIT_COUNTS } : null; }
console.log('ROW ' + JSON.stringify(out));
