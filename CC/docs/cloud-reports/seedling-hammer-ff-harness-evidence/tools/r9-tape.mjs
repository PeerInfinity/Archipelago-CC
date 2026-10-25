const R = 'file:///home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { loadTape } = await import(R + 'fixtures/index.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const { createRunForStaging, stagingFromTape } = await import(R + 'tapeRunner.js');
const J = await import(process.env.DEVJ ?? (R + 'jsRuntimeSolver.js'));
const { SPINNER } = await import(R + 'spinner.js');
const { twoPassSolve } = await import(R + 'twoPassSolve.js');
const sb = await import(R + 'solverBot.js');
const SOURCE = atlasLevelSource();
const R9 = stagingFromTape(loadTape('r9-solve-18'));
const residue = Number(process.argv[2] ?? 4);
const P = SPINNER.hammerPeriod; const was = ((R9.seam.time % P) + P) % P;
const seam = { ...R9.seam, time: R9.seam.time + ((((residue - was) % P) + P) % P) - P };
const goal = { kind: 'reach-exit', exit: { x: 176, y: 112 } };
const tp = await sb.withHammerEscape(false, () => sb.withHammerFightFallback(true, () => twoPassSolve({ makeRun: (persistence) => createRunForStaging({ ...R9, seam, persistence, equips: [] }, SOURCE), goals: [goal], name: 'r9', boot: R9.boot, persistence: R9.persistence.filter((c) => c.at === undefined), gameTick: async () => { throw new Error('x'); } })));
console.log('twoPass', tp.out.perTick.length, JSON.stringify(tp.persistence.filter(c=>c.at!==undefined)));
const staging = { ...R9, seam, persistence: tp.persistence, equips: [] };
const live = J.liveOf(createRunForStaging(staging, SOURCE));
const go = () => J.solveFromTape({ staging, perTick: [], live, levelSource: SOURCE, solverGoal: goal });
for (const on of [false, true]) {
  try {
    const p = sb.withHammerEscape(false, () => sb.withHammerFightFallback(on, go));
    console.log(on, 'OK', p.solution.length, p.expected.length, p.equipsAt.size);
  } catch (e) { console.log(on, 'ERR', e.name, e.code, String(e.message).slice(0, 300)); }
}
const p = sb.withHammerEscape(false, () => sb.withHammerFightFallback(true, go));
const rr = createRunForStaging(staging, SOURCE); const row = (r) => ({ level: r.level, x: r.state.x, y: r.state.y, deaths: r.playerDeaths.length });
const rows = [row(rr)]; for (const h of p.solution) { rr.advance(h); rows.push(row(rr)); }
let first = -1; for (let i = 0; i < rows.length; i++) if (JSON.stringify(rows[i]) !== JSON.stringify(p.expected[i])) { first = i; break; }
console.log('rows', rows.length, p.expected.length, 'first mismatch', first, 'equips', [...p.equipsAt]);
