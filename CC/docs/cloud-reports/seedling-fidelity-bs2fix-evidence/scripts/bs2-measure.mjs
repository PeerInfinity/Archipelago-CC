import { bobsoldier2Plan } from '/home/user/Archipelago-CC/scripts/procgen/plan-seedling-bobsoldier2.mjs';
import { withContactFidelity } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/contactFidelity.js';
const lapse = process.env.LAPSE === '1';
const cfgs = [['both ON', true, {}], ['both OFF', false, {}], ['D2a alone', true, { swordGate: false }], ['D2b alone', true, { killStance: false }]];
for (const [name, en, o] of cfgs) {
  const t0 = Date.now();
  const r = await withContactFidelity({ strikeIframeLapse: lapse }, () => bobsoldier2Plan(en, o));
  const kill = r.solved?.out.records.filter((x) => x.strategy === 'kill').map((k) => ({ arm: k.arm, target: k.target, stance: k.stance, ticks: k.ticks, bound: k.bound, strikes: k.strikes, killedOnWalk: k.killedOnWalk }));
  console.log(JSON.stringify({ lapse, name, solved: !!r.solved, ticks: r.solved?.out.perTick.length ?? null, driven: r.driven?.length, refusal: r.refusal?.message?.slice(0, 400) ?? null, kill, ms: Date.now() - t0 }));
}
