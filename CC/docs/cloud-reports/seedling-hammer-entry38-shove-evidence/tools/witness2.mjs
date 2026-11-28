// scratch witness via the tape path: L63 boot, wand selected and pressed in the prefix, then solveFromTape on the (0,96) exit. Measurement only.
import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const J = await import(M + 'jsRuntimeSolver.js');
const G = await import(M + 'spearPressGateWait.js');
const levelSource = atlasLevelSource();
const tape = parseTape(JSON.parse(readFileSync(M + 'fixtures/tapes/r8-solve-11.json', 'utf8')));
const staging = solveStaging(stagingFromTape(tape));
const [x, y, lead] = [Number(process.argv[2] ?? 144), Number(process.argv[3] ?? 104), Number(process.argv[4] ?? 1)];
staging.boot = { level: 63, x, y };
staging.persistence = (staging.persistence ?? []).filter((r) => r.at === undefined);
staging.seam = { ...staging.seam, items: { ...(staging.seam?.items ?? {}), hasSpear: true, hasWand: true } };
const perTick = Array.from({ length: lead }, (_, k) => new Set(k === 0 ? ['primary'] : []));
const equips = new Map([[0, Number(process.env.WAND_SLOT ?? 1)]]);
const run = J.replayTape({ staging, perTick, levelSource, equips, scratchPersistence: true });
console.log('prefix', JSON.stringify(run.progress('slashInfo')?.openUntil), 'pw', run.progress('primaryWeapon'), 't', run.ticksCompleted);
G.resetSpearPressGateWaitCounts();
try {
  const out = J.solveFromTape({ staging, perTick, live: J.liveOf(run), levelSource, solverGoal: { kind: 'reach-exit', exit: { x: 0, y: 96 } }, scratchPersistence: true, equips });
  const plan = out.plan ?? out;
  console.log('OUT keys', Object.keys(out).join(','));
  const sol = plan.solution ?? out.solution;
  const r2 = J.replayTape({ staging, perTick: [...perTick, ...sol], levelSource, equips: new Map([...equips, ...[...(plan.equipsAt ?? [])].map(([t, s]) => [t + lead, s])]), scratchPersistence: true });
  console.log('SOLVED', sol.length, 'level', J.liveOf(r2).row.level, 'hits', JSON.stringify(r2.ledger('playerHits').map((h) => [h.t, h.source, h.id])));
} catch (e) { console.log('ERROR', String(e.message).slice(0, 400)); }
console.log('SPGW', JSON.stringify(G.SPEAR_PRESS_GATE_WAIT_COUNTS));
