const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { l40LatchBoot } = await import(M + 'fidelityL40Latch.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const SB = await import(M + 'solverBot.js');
const base = await l40LatchBoot();
const mk = (tree) => {
  const boot = { ...base, boot: { ...base.boot, x: 480, y: 571 }, persistence: tree ? base.persistence.filter((p) => !(p.level === 40 && p.tag === 0)) : base.persistence };
  return createRunForStaging(solveStaging(stagingFromTape(parseTape(JSON.stringify(boot)))), atlasLevelSource());
};
for (const tree of [true, false]) for (const on of [false, true]) {
  const run = mk(tree); const t0 = Date.now();
  const r = SB.withStanceBurn(on, () => SB.holdStanceProbe(run, { x: 880, y: 768 }));
  console.log('tree', tree, 'on', on, Date.now() - t0, 'ms', JSON.stringify({ ...r, refusal: r.refusal?.slice(0, 200), tail: r.refusal?.slice(-260) }), 'fire', run.progress('inventory').hasFire, run.state.x, run.state.y);
}
