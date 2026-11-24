// MEASUREMENT ONLY (slice seedling-hammer-rocklock-mapper): a NEW-LOCKS L26 leg's event goal mapped by the page's own
// mapper (`solverGoalFor`), as the page's MAIN thread sees it: no `process.env` switch, the page URL's
// `?seedlingSolverEnv=` in `globalThis.location` (set before any import). If the mapper hands a goal over, the worker's
// solve runs on the captured request (switches as the worker would read them: `--worker=` names) and is re-driven fresh.
//   node map-and-solve.mjs --leg=286|289 --url='SEEDLING_ROCKLOCK_KILL=1' --worker=rock,write
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
for (const k of Object.keys(process.env)) if (k.startsWith('SEEDLING_')) delete process.env[k];
if (args.url) globalThis.location = { search: `?seedlingSolverEnv=${encodeURIComponent(args.url)}` };
const M = (p) => import(join(ROOT, 'frontend/modules', p));
const LEGS = await M('seedlingDemo/hammerNewLocksLegs.js');
const JR = await M('seedlingDemo/jsRuntimeSolver.js');
const SB = await M('seedlingDemo/solverBot.js');
const { atlasEventGoal, runtimeEventsOf } = await M('flashPanel/seedlingPlaybackController.js');
const { readFileSync } = await import('node:fs');
const leg = { 286: LEGS.LEG_286, 289: LEGS.LEG_289 }[args.leg];
const { passes, source, tape, levelSource } = LEGS.staged(leg);
const PT = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
const ev = runtimeEventsOf(PT).events.find((x) => x.level === 26 && x.tag?.tag === 0 || x.eventId === 'flag:L26:0');
const goal = atlasEventGoal(ev, 26);
const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence });
const out = { leg: leg.key, url: args.url ?? null, mainThread: { ROCKLOCK_KILL: SB.ROCKLOCK_KILL.enabled,
    verbOf: JR.clearTagVerbOf('solid:rocklock') } };
const mapped = JR.solverGoalFor(goal, { run, resolved: null, levelSource });
out.mapped = mapped.goal ?? null;
if (!mapped.goal) { out.refused = mapped.walker; console.log(JSON.stringify(out)); process.exit(0); }
out.sameAsCaptured = JSON.stringify(mapped.goal) === JSON.stringify(tape.solverGoal);
const w = new Set((args.worker ?? '').split(',').filter(Boolean));
const answer = SB.withRockLockKill(w.has('rock'), () => SB.withKillLockClearWrite(w.has('write'),
    () => JR.solveAnytime({ ...tape, solverGoal: mapped.goal, source, levelSource }, { passes })));
if (!answer.ok) { out.solve = { ok: false, message: String(answer.message).slice(0, 400) }; console.log(JSON.stringify(out)); process.exit(0); }
const fresh = JR.replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...answer.plan.solution], levelSource,
    scratchPersistence: tape.scratchPersistence });
out.solve = { ok: true, ticks: answer.plan.solution.length, verbs: answer.plan.verbs,
    planSha: createHash('sha1').update(JSON.stringify(answer.plan.solution.map((k) => [...k]))).digest('hex').slice(0, 12),
    hits: fresh.ledger('playerHits').length, earned: fresh.ledger('earnedClears').map((c) => `${c.level}:${c.tag}`),
    writes: fresh.scratchClears.map(({ level, tag }) => `${level}:${tag}`) };
console.log(JSON.stringify(out));
