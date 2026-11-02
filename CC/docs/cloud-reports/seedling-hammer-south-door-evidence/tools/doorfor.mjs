// scratch (SOUTHDOOR): see the report
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { l40LatchBoot } = await import(M + 'fidelityL40Latch.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const SB = await import(M + 'solverBot.js');
for (const at of [{ x: 480, y: 571 }, { x: 480, y: 496 }, { x: 480, y: 896 }, null]) {
  let boot = await l40LatchBoot();
  if (at) boot = { ...boot, boot: { ...boot.boot, x: at.x, y: at.y } };
  const run = createRunForStaging(solveStaging(stagingFromTape(parseTape(JSON.stringify(boot)))), atlasLevelSource());
  run.advance(new Set());
  const t = run.entities('turrets').get('iceturret@472,400');
  const r = t.rect; const cx = (r.x + r.right) / 2, cy = (r.y + r.bottom) / 2;
  const sides = [{ key: 'up', x: cx, y: r.bottom + 5 }, { key: 'right', x: r.x - 5, y: cy }, { key: 'left', x: r.right + 5, y: cy }];
  const t0 = Date.now();
  const ans = SB.approachDoorFor(run, sides, new Set(['proximity-hazard:iceturret@472,400']));
  console.log(JSON.stringify(at), 'state', run.state.x, run.state.y, 'rect', JSON.stringify(r), 'open', [...run.entities('openActivators')].join(','), '->', JSON.stringify(ans), Date.now() - t0, 'ms');
}
{
  let boot = await l40LatchBoot(); boot = { ...boot, boot: { ...boot.boot, x: 480, y: 571 } };
  const run = createRunForStaging(solveStaging(stagingFromTape(parseTape(JSON.stringify(boot)))), atlasLevelSource());
  run.advance(new Set());
  console.log('HYPO', JSON.stringify(SB.stanceHypothesisProbe(run)));
}
