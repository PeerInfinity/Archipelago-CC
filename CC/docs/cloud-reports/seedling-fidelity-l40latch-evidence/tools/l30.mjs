const { l30keylockPlan } = await import('/home/user/Archipelago-CC/scripts/procgen/plan-seedling-l30keylock.mjs');
const { withContactFidelity } = await import('/home/user/Archipelago-CC/frontend/modules/seedlingDemo/contactFidelity.js');
for (const [label, over] of [['orbit', { chaserOrbitKill: true }], ['hold', { holdWaitPriced: true }]]) {
  for (const [x, opts] of [[224, { rescan: false, waitPriced: false }], [240, { rescan: false, waitPriced: false }], [224, { rescan: false, waitPriced: true }], [240, { rescan: false, waitPriced: true }], [224, { rescan: true, waitPriced: false }], [240, { rescan: true, waitPriced: false }]]) {
    const p = await withContactFidelity({ strikeIframeLapse: false, ...over }, () => l30keylockPlan(x, opts));
    const rec = (p.solved?.out?.records ?? []).filter((r) => r.arm === 'orbit').map((r) => `${r.candidate} ${r.ticks}t`);
    console.log(label, x, JSON.stringify(opts), 'solved', p.solved ? p.solved.out.perTick.length : null, 'hits', p.run.playerHits.length, rec.join(';'), p.refusal ? p.refusal.message.slice(0, 160) : '');
  }
}
