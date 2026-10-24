import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const MODULE = join(process.cwd(), 'frontend/modules/seedlingDemo');
const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { deriveFight } = await import(join(MODULE, 'solverBot.js'));
const { withGhostSearchBuckets } = await import(join(MODULE, 'ghostSpinnerPress.js'));
const base = parseTape(readFileSync(join(MODULE, 'fixtures/witness-bases/r9-solve-18.hammer-a.json'), 'utf8'));
const st = stagingFromTape(base);
for (const ghost of [false, true]) for (const on of [false, true]) {
  const staging = { ...st, seam: { ...st.seam, items: { ...st.seam.items, hasGhostSword: ghost } }, persistence: st.persistence.filter((c) => c.at === undefined), equips: [] };
  const make = () => createRunForStaging(staging, atlasLevelSource());
  const run = make();
  const targets = run.entities('spinnerBodies').map((b) => b.id);
  const t0 = Date.now();
  const f = withGhostSearchBuckets(on, () => deriveFight(run, { targets, lastPressAt: -31, caller: 'probe' }));
  const r = make(); for (const k of f.fight?.keys ?? []) r.advance(k);
  const land = r.spinnerPressHits.filter((h) => h.landed).map((h) => [h.t, Number(h.reach.toFixed(2))]);
  console.log(JSON.stringify({ ghost, on, ok: f.ok, bound: f.bound, goal: f.fight?.goal, end: f.fight?.end, exp: f.record.expansions, inReach: f.record.inReach, presses: f.record.presses, land, hits: r.playerHits.length, ms: Date.now() - t0, keys: JSON.stringify((f.fight?.keys ?? []).map((k) => [...k])).length }));
}
