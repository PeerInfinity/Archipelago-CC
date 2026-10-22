const R=(process.env.TREE ?? '/home/user/Archipelago-CC') + '/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(R+'levelSource.js');
const { createRunForStaging } = await import(R+'tapeRunner.js');
const { arrivalStaging } = await import(R+'fidelityArrival.js');
const { solveSegment, SolverRefusal } = await import(R+'solverBot.js');
const SRC = atlasLevelSource();
const cases = {
  l16: { boot: { level: 16, x: 32, y: 64 }, goal: { kind: 'clear-tag', tag: { level: 16, tag: 0 }, at: { x: 32, y: 16 }, obstacle: 'rope@32,16' } },
  l39: { boot: { level: 39, x: 144, y: 608 }, goal: { kind: 'clear-tag', tag: { level: 39, tag: Number(process.env.L39TAG ?? 0) }, at: { x: 96, y: 384 }, obstacle: 'rope@96,384' } },
  l16s: { boot: { level: 16, x: 72, y: 40 }, goal: { kind: 'clear-tag', tag: { level: 16, tag: 0 }, at: { x: 32, y: 16 }, obstacle: 'rope@32,16' } },
  l28: { boot: { level: 28, x: 96, y: 16 }, goal: { kind: 'clear-tag', tag: { level: 28, tag: 0 }, at: { x: 160, y: 64 }, obstacle: 'rope@160,64' } },
};
const want = process.argv.slice(2);
for (const [k, c] of Object.entries(cases)) {
  if (want.length && !want.includes(k)) continue;
  const items = (process.env.ITEMS ?? 'hasSword').split(',').filter(Boolean);
  const cleared = (process.env.CLEARED ?? '').split(',').filter(Boolean).map(Number);
  const st = arrivalStaging(c.boot, { items, cleared });
  const run = createRunForStaging(st, SRC);
  const r0 = run.world.solids.filter((s) => s.ropeId).map((s) => `${s.ropeId} t=${s.ropeT} tag=${s.ropeTag} boot=${s.bootPulled} rect=${JSON.stringify(s.rect)}`);
  console.log(k, 'ropes', r0);
  const t0 = Date.now();
  try {
    const out = solveSegment({ run, goals: [c.goal], name: `rope-${k}`, boot: c.boot });
    const ticks = out.perTick?.length ?? out.ticks?.length;
    console.log(k, 'SOLVED', ticks, 't', JSON.stringify(out.records?.filter(r=>r.goal==='clear-tag'||r.strategy==='rope'||r.strategy==='pull')).slice(0,900));
    console.log('  earned', JSON.stringify(run.ledger('earnedClears')), 'pulls', JSON.stringify(run.ledger('ropePulls')), 'hits', run.ledger('playerHits')?.length);
  } catch (e) {
    if (!(e instanceof SolverRefusal)) throw e;
    console.log(k, 'REFUSED', JSON.stringify(e.obstacle ?? e.details?.obstacle), e.message.slice(0, 500));
  }
  console.log('  ms', Date.now() - t0);
}
