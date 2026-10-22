import { bobsoldier2Plan, BOBSOLDIER2_STEP50 } from '/home/user/Archipelago-CC/scripts/procgen/plan-seedling-bobsoldier2.mjs';
import { withContactFidelity } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/contactFidelity.js';
import { createRunForStaging } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/tapeRunner.js';
import { atlasLevelSource } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/levelSource.js';
const lapse = process.env.LAPSE !== '0';
const [en, ks, sg] = (process.env.CFG ?? '0,0,0').split(',').map((x) => x === '1');
await withContactFidelity({ strikeIframeLapse: lapse }, async () => {
  const r = await bobsoldier2Plan(en, { killStance: ks, swordGate: sg });
  const keys = r.solved ? r.solved.out.perTick : r.driven;
  const run = createRunForStaging({ ...r.staging }, atlasLevelSource());
  let prev = '';
  keys.forEach((h, i) => {
    run.advance(h);
    const b = [...(run.entities('chasers') ?? [])].find((c) => c.id === BOBSOLDIER2_STEP50.body);
    const s = `${b ? `h${b.hits} ${b.destroy ? 'DEAD' : ''}${b.dying ? 'dying' : ''}` : 'gone'} torch=${!!run.inventory?.hasTorch} L${run.level}`;
    if (s !== prev || i === keys.length - 1) console.log(i + 1, `(${run.state.x.toFixed(2)},${run.state.y.toFixed(2)})`, b ? `body(${b.x.toFixed(1)},${b.y.toFixed(1)})` : '', s, [...h].join('+'));
    prev = s;
  });
  console.log('refusal:', r.refusal?.message?.slice(0, 300));
  if (r.solved) console.log(JSON.stringify(r.solved.out.records.map((x) => ({ s: x.strategy, arm: x.arm, t: x.t, ticks: x.ticks, stance: x.stance, killedOnWalk: x.killedOnWalk }))));
});
