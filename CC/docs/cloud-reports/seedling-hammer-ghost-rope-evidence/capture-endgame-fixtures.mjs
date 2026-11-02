const D=new URL('../../../../frontend/modules/', import.meta.url).pathname;
const { seedlingSeam } = await import(D+'seedlingDemo/procgenSeedling.js');
const P = await import(D+'seedlingDemo/procgenPalette.js');
const O = await import(D+'seedlingDemo/procgenOracle.js');
const { parseElementSpec } = await import(D+'procgenCore/elementSpec.js');
const { parseSkeleton } = await import(D+'procgenCore/skeletonKinds.js');
const fs = await import('node:fs');
for (const seed of [1,2,3]) {
  const caps = [];
  const seam = seedlingSeam({ seed, items: P.ENDGAME_PALETTE.items, defaults: { width: 10, height: 10 },
    skeleton: parseSkeleton('empty', { substrate: 'seedling' }), elements: parseElementSpec('ropegate'),
    floodWalks: P.ENDGAME_PALETTE.floodWalks,
    wrapOracle: (o) => ({ ...o, solve(record, opts) { const pins = o.pinsFor(opts?.templates ?? [], record); caps.push({ record, pins }); return o.solve.call(o, record, opts); } }) });
  const m = seam.model; const c = caps[0];
  const fx = { seed, palette: 'endgame', recipe: "seedlingSeam({seed, items: ENDGAME_PALETTE.items, defaults:{width:10,height:10}, skeleton: parseSkeleton('empty'), elements: parseElementSpec('ropegate')}) — the certification solve's record",
    boot: m.boot(), items: P.ENDGAME_PALETTE.items, pins: c.pins, goals: m.goals, record: c.record };
  const out = O.solve(fx.record, O.bootStaging({ boot: fx.boot, items: fx.items, pins: fx.pins }), fx.goals, O.DEFAULT_BUDGET, { name: `procgen-l${fx.record.level}` });
  console.log(seed, caps.length, seam.certification.verdict, out.verdict, out.obstacle?.id, JSON.stringify(fx).length, JSON.stringify(fx.pins), JSON.stringify(fx.boot), fx.record.entities.map(e=>e.type).join(','));
  fs.writeFileSync(`fx-${seed}.json`, JSON.stringify(fx));
}
