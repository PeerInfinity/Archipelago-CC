import { readFileSync, writeFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const P = await import(M + 'tentacleBeastPolicy.js');
const base = JSON.parse(readFileSync('/tmp/claude-0/d1/l57-idle-a.json', 'utf8'));
const seed = +(process.argv[2] || 1), vi = +(process.argv[3] || 0);
const tape = { ...base, rng: { ...base.rng, seed }, inputs: [], tick_count: 0, name: `tb-policy-s${seed}` };
const staging = stagingFromTape(parseTape(JSON.stringify(tape)));
withContactFidelity({ tentacleBeastFight: true }, () => {
  const run = createRunForStaging(staging, atlasLevelSource());
  const mem = P.createTentacleBeastPolicy(P.TENTACLE_BEAST_POLICY_VARIANTS[vi]);
  const per = [];
  let end = null;
  for (let i = 0; i < 4000; i++) {
    const view = run.entities('tentacleBeastFight');
    if (view.mouth && end === null) end = i;
    if (end !== null && (run.level !== 57 || i > end + (process.env.MOUTH ? 400 : 60))) break;
    let held = P.tentacleBeastPolicyStep(mem, { view, p: run.state, slashing: run.progress('slashInfo').state.slashing });
    if (end !== null && process.env.MOUTH) { held = new Set(); const p = run.state; if (Math.abs(p.x - 104) > 1) held.add(p.x < 104 ? 'right' : 'left'); held.add('up'); }
    per.push([...held]);
    const adv = run.advance(held);
    if (adv?.transition) { console.log('TRANSITION at', i, JSON.stringify(adv.transition).slice(0, 300)); per.push([]); break; }
    const hits = run.ledger('playerHits') ?? [];
    if (hits.some((h) => h.died)) { console.log('DIED at', i, JSON.stringify(hits.slice(-2))); break; }
  }
  const v = run.entities('tentacleBeastFight');
  console.log('level', run.level, 'pos', run.state.x, run.state.y, 'seed', seed, 'var', vi, 'ticks', per.length, 'mouth at', end, 'maxT', v?.beast.maxTentacles, 'hits', (run.ledger('playerHits') ?? []).length, 'strikes', mem.log.length);
  // build an input list
  const inputs = [];
  const keysAll = ['up','down','left','right','primary'];
  for (const k of keysAll) { let from = null; for (let t = 0; t <= per.length; t++) { const on = t < per.length && per[t].includes(k); if (on && from === null) from = t; if (!on && from !== null) { inputs.push({ key: k, from, to: t }); from = null; } } }
  inputs.sort((a, b) => a.from - b.from);
  writeFileSync(`/tmp/claude-0/d3/tb-policy-s${seed}-v${vi}${process.env.MOUTH ? '-mouth' : ''}.json`, JSON.stringify({ ...tape, inputs, tick_count: per.length, description: 'bosskills D3 tentacle policy' }, null, 1));
});
