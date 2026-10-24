// scratch: replay C4's stance (264,120) walk's MOVEMENT keys (its primary stripped) and let the strike policy decide
// the presses on the live run, as `drive` does (decide(state, run.strikeBodies, tick, walkHeld)); write the tape.
import { readFileSync, writeFileSync } from 'node:fs';
const M = (p) => import(`/home/user/Archipelago-CC/frontend/modules/seedlingDemo/${p}`);
const { parseTape } = await M('tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await M('tapeRunner.js');
const { atlasLevelSource } = await M('levelSource.js');
const { strikePolicyFor } = await M('solverBot.js');
const { buildStagedTape } = await M('botDriverV1.js');
const src = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const tape = parseTape(JSON.stringify(src));
const staging = stagingFromTape(tape);
const run = createRunForStaging(staging, atlasLevelSource());
const policy = strikePolicyFor(run);
const N = Number(process.env.TICKS ?? tape.tick_count);
const held = (k) => new Set(tape.inputs.filter((i) => i.from <= k && k < i.to && i.key !== 'primary').map((i) => i.key));
const perTick = [];
for (let k = 0; k < N; k += 1) {
  const d = policy.decide(run.state, run.strikeBodies, run.ticksCompleted, held(k), { slash: run.slashState ?? null });
  perTick.push(new Set(d.held));
  run.advance(new Set(d.held));
}
const rows = policy.trace.filter((r) => r.decision !== 'none').map((r) => `${r.tick}:${r.decision}:${r.target ?? ''}${r.iframeLapse ? ' lapse' + JSON.stringify(r.iframeLapse) : ''}`);
console.log(rows.join('\n'));
console.log('hits', JSON.stringify(run.playerHits.map((h) => [h.t, h.id])), 'deaths', run.ledger('playerDeaths').length);
const t2 = buildStagedTape({ staging: { ...staging, equips: [] }, perTick, name: process.env.NAME ?? 'l74leg624-lapse-policy-walk' });
const obj = typeof t2 === 'string' ? JSON.parse(t2) : t2;
obj.seam?.items && delete obj.seam.items.hitsMax;
writeFileSync(process.env.OUT, JSON.stringify(obj, null, 1));
