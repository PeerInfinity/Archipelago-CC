const D = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(D+'levelSource.js');
const { createRunForStaging } = await import(D+'tapeRunner.js');
const { arrivalStaging } = await import(D+'fidelityArrival.js');
const { CONTACT_FIDELITY } = await import(D+'contactFidelity.js');
const { solveSegment, SolverRefusal } = await import(D+'solverBot.js');
const SRC = atlasLevelSource();
const CUT = { kind: 'clear-tag', tag: { level: 28, tag: 0 }, at: { x: 160, y: 64 }, obstacle: 'rope@160,64' };
const ARR = { L25: { level: 28, x: 96, y: 16 }, L26: { level: 28, x: 16, y: 96 } };
const EX = { t0_96: { x: 0, y: 96 }, t96_0: { x: 96, y: 0 } };
const only = process.argv[2];
for (const [an, boot] of Object.entries(ARR)) for (const [en, ex] of Object.entries(EX)) {
  if (only && only !== `${an}/${en}`) continue;
  const staging = arrivalStaging(boot, { items: ['hasFire'] });
  const run = createRunForStaging(staging, SRC);
  const t0 = Date.now();
  try {
    const out = solveSegment({ run, goals: [{ ...CUT }, { kind: 'reach-exit', exit: ex }], name: 'da', boot,
      forkRun: () => createRunForStaging(staging, SRC) });
    const hits = (run.ledger('playerHits') ?? []).length;
    console.log(an, en, 'SOLVED', out.perTick.length, 't hits', hits, 'level', run.state.level ?? run.level, (Date.now()-t0)+'ms',
      JSON.stringify((out.records??[]).map(r=>[r.goal, r.drillPass?.ticks, r.drillPass?.verb ?? null, r.drillPass?.exitAfter?.passedOver ?? null])));
  } catch (e) {
    if (!(e instanceof SolverRefusal)) throw e;
    console.log(an, en, 'REFUSED', (Date.now()-t0)+'ms', e.message.split('\n')[0].slice(0, Number(process.env.MSGLEN ?? 400)));
  }
}
