// MEASUREMENT-ONLY: the L40 flag-8 staging of leg 395/412 (hammerKeylockTurretL40), solved with GOAL=cleartag|exit.
// node leg.mjs <395|412> <cleartag|exit> [door=1]
const ROOT = '/home/user/Archipelago-CC';
const [leg, goalKind, door = '1', idle = '0'] = process.argv.slice(2);
const pre = Array.from({ length: Number(idle) }, () => new Set());
const L = await import(`${ROOT}/frontend/modules/seedlingDemo/hammerKeylockTurretL40.js`);
const { liveOf, replayTape, settleSolve, solveFromTape } = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const { atlasLevelSource } = await import(`${ROOT}/frontend/modules/seedlingDemo/levelSource.js`);
const sb = await import(`${ROOT}/frontend/modules/seedlingDemo/solverBot.js`);
const staging = L.l40Flag8Staging({ ...(leg === '395' ? L.LEG_395 : L.LEG_412), door: door === '1' });
const goal = goalKind === 'exit' ? { kind: 'reach-exit', exit: { x: 944, y: 96 } }
    : { kind: 'clear-tag', tag: { level: 40, tag: 8 }, at: { x: 480, y: 352 }, obstacle: 'bosslock@480,352' };
const levelSource = atlasLevelSource();
const live = liveOf(replayTape({ staging, perTick: pre, levelSource, scratchPersistence: true }));
const t0 = Date.now();
const a = settleSolve(() => solveFromTape({ staging, perTick: pre, live, levelSource, solverGoal: goal, name: 'kt-leg', scratchPersistence: true,
    dashMode: 'none', fineCheckpoints: true }));
console.log(`LEG ${leg} goal=${goalKind} door=${door} idle=${idle} ok=${a.ok} ms=${Date.now() - t0} ticks=${a.ok ? a.plan.solution.length : null}`);
if (a.ok) {
    const run = replayTape({ staging, perTick: pre, levelSource, scratchPersistence: true });
    let tr = null;
    for (const k of a.plan.solution) { const o = run.advance(k); if (o?.transition && !tr) tr = { t: run.ticksCompleted, to: o.transition.to_level }; }
    console.log(`  verbs=${JSON.stringify(a.plan.verbs)} FRESH hits=${JSON.stringify(run.playerHits.map((h) => `t${h.t} ${h.source}:${h.id}`))} deaths=${run.playerDeaths.length} open=${run.entities('openActivators').has('bosslock@480,352')} dead=${run.entities('turrets').get('iceturret@472,400')?.dead === true} transition=${JSON.stringify(tr)}`);
} else console.log(`  message=${String(a.message).slice(0, 2500)}`);
for (const n of ['KEYLOCK_TURRET_COUNTS', 'KEYLOCK_TURRET_ARRIVAL_COUNTS', 'TURRET_APPROACH_COUNTS']) console.log(`  ${n}=${JSON.stringify(sb[n]).slice(0, 900)}`);
