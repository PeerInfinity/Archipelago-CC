const D = process.argv[2] + '/frontend/modules/seedlingDemo/';
const F = await import(D + 'fidelityFrozenPress.js');
const { parseTape } = await import(D + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(D + 'tapeRunner.js');
const { atlasLevelSource } = await import(D + 'levelSource.js');
const SP = await import(D + 'strikePolicy.js');
const { FACING_KEYS, facingToward } = await import(D + 'solverBot.js');
const tape = await F.frozenPressModelTape('frozenpress-l40-lost');
const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(tape))));
const per = F.frozenPressPerTick([]);
for (const aimAt of [51]) for (const arm of ['off', 'on']) {
  const run = createRunForStaging(staging, atlasLevelSource());
  for (let t = 0; t < aimAt; t++) run.advance(per[t]);
  const s = run.state;
  const body = { id: 'bob@test', as3: 'Bob', rect: { x: s.x - 6, y: s.y - 22, w: 12, h: 12, right: s.x + 6, bottom: s.y - 10 }, hitsTimer: 0 };
  const p = SP.createStrikePolicy({ facingToward, facingKeys: FACING_KEYS });
  const out = [];
  try {
    for (let t = aimAt; t < 70; t++) {
      const ff = run.progress('freezeForecast');
      const opts = arm === 'on' ? SP.strikeDecideOpts(run) : { slash: run.progress('slashInfo') };
      const d = p.decide(run.state, [body], run.ticksCompleted, per[t], opts);
      out.push(`${t}:${d.decision}:${[...d.held].join('+')}:${ff.refusedNext ? 'R' : '-'}`);
      run.advance(d.held);
    }
    console.log(arm, 'OK', out.join(' '));
  } catch (e) { console.log(arm, 'THROW', e.code, out.join(' '), e.message.slice(0, 160)); }
}
