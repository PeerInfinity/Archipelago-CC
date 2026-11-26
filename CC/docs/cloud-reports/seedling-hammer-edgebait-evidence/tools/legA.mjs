// MEASUREMENT-ONLY (edgebait): the L40 flag-8 staging of leg 395/412 solved as the page WORKER does (solveAnytime, the
// captured request's passes and budgetWork 640 unless BUDGET=<n>), then replayed on a fresh run.
// node legA.mjs <395|412> <cleartag|exit> [door=1] [idle=0]
const ROOT = '/home/user/Archipelago-CC';
const [leg, goalKind, door = '1', idle = '0'] = process.argv.slice(2);
const pre = Array.from({ length: Number(idle) }, () => new Set());
const L = await import(`${ROOT}/frontend/modules/seedlingDemo/hammerKeylockTurretL40.js`);
const { liveOf, replayTape, solveAnytime } = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const { atlasLevelSource } = await import(`${ROOT}/frontend/modules/seedlingDemo/levelSource.js`);
const sb = await import(`${ROOT}/frontend/modules/seedlingDemo/solverBot.js`);
const staging = L.l40Flag8Staging({ ...(leg === '395' ? L.LEG_395 : L.LEG_412), door: door === '1' });
const goal = goalKind === 'exit' ? { kind: 'reach-exit', exit: { x: 944, y: 96 } }
    : { kind: 'clear-tag', tag: { level: 40, tag: 8 }, at: { x: 480, y: 352 }, obstacle: 'bosslock@480,352' };
const levelSource = atlasLevelSource();
const live = liveOf(replayTape({ staging, perTick: pre, levelSource, scratchPersistence: true }));
const passes = [{ pass: 'dashless', dashMode: 'none', stop: 'all' }, { pass: 'full', dashMode: 'all', adds: 'sword-dash', stop: 'window' }];
const env = Object.entries(process.env).filter(([k]) => k.startsWith('SEEDLING_') || k.startsWith('HOOK_') || k === 'BUDGET').map(([k, v]) => `${k}=${v}`).join(' ');
const t0 = Date.now();
const a = solveAnytime({ staging, perTick: pre, live, levelSource, solverGoal: goal, name: 'kt-leg', scratchPersistence: true, equips: null,
    budgetWork: Number(process.env.BUDGET ?? 640), upgradeWindowWork: 85 }, { passes });
console.log(`LEGA ${leg} goal=${goalKind} door=${door} idle=${idle} env[${env}] ok=${a.ok} work=${a.work} ticks=${a.ok ? a.plan.solution.length : null} ms=${Date.now() - t0}`);
console.log(`  passes=${JSON.stringify(a.passes?.map(({ ms, ...p }) => p))}`);
if (a.ok) {
    const run = replayTape({ staging, perTick: pre, levelSource, scratchPersistence: true });
    let tr = null;
    for (const k of a.plan.solution) { const o = run.advance(k); if (o?.transition && !tr) tr = { t: run.ticksCompleted, to: o.transition.to_level }; }
    console.log(`  FRESH hits=${JSON.stringify(run.playerHits.map((h) => `t${h.t} ${h.source}:${h.id}`))} deaths=${run.playerDeaths.length} open=${run.entities('openActivators').has('bosslock@480,352')} dead=${run.entities('turrets').get('iceturret@472,400')?.dead === true} transition=${JSON.stringify(tr)}`);
} else console.log(`  message=${String(a.message).slice(0, 600)}`);
for (const n of ['KEYLOCK_TURRET_COUNTS', 'KEYLOCK_TURRET_ARRIVAL_COUNTS', 'TURRET_APPROACH_COUNTS', 'ICETURRET_STATIC_KILL_COUNTS']) if (sb[n]) console.log(`  ${n}=${JSON.stringify(sb[n]).slice(0, 700)}`);
