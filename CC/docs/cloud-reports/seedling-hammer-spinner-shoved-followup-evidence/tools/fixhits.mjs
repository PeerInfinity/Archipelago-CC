// fixhits.mjs <fixture path under seedlingDemo/fixtures> [cap=2560] : the census's dashless solve of the fixture's first request at the env's
// switches, the plan replayed on a fresh run: verdict, ticks, sha, the player hits (t:id), the refusal's head.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const R = process.env.REPO || process.cwd();
const M = R + '/frontend/modules/seedlingDemo/';
const { restoreRequest } = await import(R + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { settleSolve, solveFromTape, replayTape } = await import(M + 'jsRuntimeSolver.js');
const FIX = JSON.parse(gunzipSync(readFileSync(M + 'fixtures/' + process.argv[2])).toString('utf8'));
const CAP = Number(process.argv[3] ?? 2560);
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX.requests[0].request);
const levelSource = levelSourceFromAtlas(source.records);
let work = 0;
const a = settleSolve(() => solveFromTape({ ...tape, levelSource, dashMode: 'none', adds: null, fineCheckpoints: true, shouldStop: () => { work += 1; return work > CAP; } }));
const r = { fixture: process.argv[2], key: FIX.key ?? null, ok: a.ok, work };
if (a.ok) {
    const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    const h0 = run.playerHits.length;
    a.plan.solution.forEach((k, i) => { const s = a.plan.equipsAt?.get?.(i); if (s !== undefined) run.equipNow(s); run.advance(k); });
    Object.assign(r, { ticks: a.plan.solution.length, sha: createHash('sha256').update(JSON.stringify(a.plan.solution.map((s) => [...s]))).digest('hex').slice(0, 12),
        hits: run.playerHits.slice(h0).map((h) => `${h.t}:${h.id}`) });
} else r.message = String(a.message).slice(0, 500);
console.log(JSON.stringify(r));
