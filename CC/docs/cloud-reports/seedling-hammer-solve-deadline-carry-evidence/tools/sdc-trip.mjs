const R = 'file:///home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { loadTape } = await import(R + 'fixtures/index.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const { createRunForStaging, stagingFromTape } = await import(R + 'tapeRunner.js');
const { liveOf, solveFromTape } = await import(R + 'jsRuntimeSolver.js');
const { SPINNER } = await import(R + 'spinner.js');
const sb = await import(R + 'solverBot.js');
const SOURCE = atlasLevelSource();
const R9 = stagingFromTape(loadTape('r9-solve-18'));
const P = SPINNER.hammerPeriod; const was = ((R9.seam.time % P) + P) % P;
const seam = { ...R9.seam, time: R9.seam.time + ((((4 - was) % P) + P) % P) - P };
const T = { ...R9, seam, persistence: R9.persistence.map((c) => (c.at === undefined ? c : { ...c, at: 323 })), equips: [] };
const mode = process.argv[2] ?? 'after';
const fallbacks = []; sb.HAMMER_FIGHT_FALLBACK_TRACE.sink = (r) => fallbacks.push(r);
const asked = [];
const shouldStop = (site) => { asked.push([site, fallbacks.length]); return mode === 'after' ? fallbacks.length > 0 : mode === 'site' ? site === process.argv[3] : false; };
sb.HAMMER_ESCAPE.enabled = false;
try {
  const plan = sb.withHammerFightFallback(true, () => solveFromTape({ staging: T, perTick: [], live: liveOf(createRunForStaging(T, SOURCE)), levelSource: SOURCE, solverGoal: { kind: 'reach-exit', exit: { x: 176, y: 112 } }, shouldStop }));
  console.log('OK', plan.solution.length, plan.expected.length, JSON.stringify(plan.deadline));
} catch (e) { console.log('ERR', e.name, e.message.slice(0, 300)); }
console.log('fallbacks', JSON.stringify(fallbacks.map(({ms, ...r}) => r)));
const c = {}; for (const [s, f] of asked) { const k = s + '@' + f; c[k] = (c[k] ?? 0) + 1; } console.log('asked', JSON.stringify(c));
