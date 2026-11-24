// MEASUREMENT ONLY (slice seedling-hammer-yeti-talk): the L58 event leg solved in node under the env, through the
// SAME mapper the page uses (solverGoalFor), folded into a staged tape for play-request.mjs's play phase.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const ROOT = '/home/user/Archipelago-CC'; const M = join(ROOT, 'frontend/modules/seedlingDemo');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const { atlasEventGoal, runtimeEventsOf } = await import(join(ROOT, 'frontend/modules/flashPanel/seedlingPlaybackController.js'));
const JR = await import(join(M, 'jsRuntimeSolver.js'));
const SB = await import(join(M, 'solverBot.js'));
const { atlasLevelSource } = await import(join(M, 'levelSource.js'));
const { createRunForStaging } = await import(join(M, 'tapeRunner.js'));
const { arrivalStaging } = await import(join(M, 'fidelityArrival.js'));
const { buildStagedTape } = await import(join(M, 'botDriverV1.js'));
const { parseTape, gameVisibleTape } = await import(join(M, 'tapeFormat.js'));
const PT = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
const SC = PT.preset_sidecars['1'];
const e = runtimeEventsOf(PT).events.find((x) => x.eventId === 'flag:L58:1');
const g = atlasEventGoal(e, SC[e.side].playable_payload.level);
const boot = { level: 58, x: 48, y: 96 };
const items = (args.items ?? 'hasSword,canSwim').split(',');
const SRC = atlasLevelSource();
const staging = arrivalStaging(boot, { items });
const run = createRunForStaging(staging, SRC);
const out = { arm: args.arm, env: { talkClearGoal: JR.TALK_CLEAR_GOAL.enabled, yetiTalk: SB.clearTagTalkArmOf('yeti') }, boot, items };
const mapped = JR.solverGoalFor(g, { run, resolved: null });
if (!mapped.goal) { out.ok = false; out.message = mapped.walker; writeFileSync(args.out, JSON.stringify(out) + '\n'); console.log(`${args.arm}: MAPPER REFUSED — ${mapped.walker}`); process.exit(0); }
let seg;
try { seg = SB.solveSegment({ run, goals: [mapped.goal], name: 'yeti-talk-L58', boot }); }
catch (err) { out.ok = false; out.message = err.message; writeFileSync(args.out, JSON.stringify(out) + '\n'); console.log(`${args.arm}: SOLVER REFUSED — ${err.message}`); process.exit(0); }
out.ok = true; out.ticks = seg.perTick.length; out.records = seg.records;
out.earned = run.ledger('earnedClears').filter((c) => c.level === 58);
out.modelHits = run.damage.hits;
const fresh = createRunForStaging(staging, SRC);
const expected = [{ level: fresh.level, x: fresh.state.x, y: fresh.state.y }];
for (const h of seg.perTick) { fresh.advance(h); expected.push({ level: fresh.level, x: fresh.state.x, y: fresh.state.y }); }
out.expected = expected;
out.digest = createHash('md5').update(JSON.stringify(seg.perTick.map((k) => [...k]))).digest('hex').slice(0, 12);
out.tape = gameVisibleTape(parseTape(buildStagedTape({ staging, perTick: seg.perTick, name: `yeti-talk-${args.arm}` })));
writeFileSync(args.out, JSON.stringify(out) + '\n');
console.log(`${args.arm}: SOLVED ${out.ticks} t digest=${out.digest} hits=${out.modelHits} earned=${JSON.stringify(out.earned)} rec=${JSON.stringify(seg.records).slice(0, 300)}`);
