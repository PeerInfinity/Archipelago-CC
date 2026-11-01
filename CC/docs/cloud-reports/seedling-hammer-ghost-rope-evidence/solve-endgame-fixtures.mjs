const D=new URL('../../../../frontend/modules/seedlingDemo/', import.meta.url).pathname;
const O = await import(D+'procgenOracle.js');
const fs = await import('node:fs');
for (const seed of [1,2,3]) {
  const fx = JSON.parse(fs.readFileSync(new URL(`../../../../frontend/modules/seedlingDemo/fixtures/ghost-rope/endgame-ropegate-s${seed}.json`, import.meta.url),'utf8'));
  const t0=Date.now();
  const out = O.solve(fx.record, O.bootStaging({ boot: fx.boot, items: fx.items, pins: fx.pins }), fx.goals, O.DEFAULT_BUDGET, { name: `procgen-l${fx.record.level}` });
  console.log(seed, out.verdict, out.ticks, (out.records??[]).map(r=>`${r.strategy}${r.weapon?':'+r.weapon:''}${r.stance?`@${r.stance.x},${r.stance.y}`:''}`).join(' '), out.obstacle?.id ?? '', Date.now()-t0+'ms', out.verdict!=='SOLVED'? String(out.reasonText).slice(0,600):'');
}
