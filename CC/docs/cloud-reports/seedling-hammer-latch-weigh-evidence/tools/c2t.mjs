// scratch (LWEIGH): procgenWeigh's C2-no-block room plus a live ice turret beside the button; OFF vs ON.
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain } = await import(M + 'procgenLevel.js');
const { DEFAULT_BUDGET, bootStaging, collectGoal, solve } = await import(M + 'procgenOracle.js');
const { PRE_SWORD_ITEMS } = await import(M + 'procgenPalette.js');
const { SEEDLING_DEFAULTS } = await import(M + 'procgenSeedling.js');
const SB = await import(M + 'solverBot.js');
const [ttx, tty] = (process.env.T ?? '6,1').split(',').map(Number);
function go() {
  const START = SEEDLING_DEFAULTS.start;
  let record = emptyLevel({ level: SEEDLING_DEFAULTS.level });
  const walls = [];
  for (let tx = 1; tx <= 8; tx += 1) if (tx !== 4) walls.push({ tx, ty: 5, terrain: 'wall' });
  record = withTerrain(record, walls);
  record = withEntities(record, [
    { type: SEEDLING_DEFAULTS.goalClass, ...oelAtTile(7, 8), attrs: { tag: SEEDLING_DEFAULTS.goalTag } },
    { type: 'lock', ...oelAtTile(4, 5), attrs: { tset: '0', tag: '0' } },
    { type: 'button', ...oelAtTile(6, 3), attrs: { tset: '0' } },
    { type: 'iceturret', ...oelAtTile(ttx, tty) },
  ]);
  const staging = bootStaging({ boot: bootAtTile(record, START.tx, START.ty), items: PRE_SWORD_ITEMS, pins: ['dead_frames'] });
  return solve(record, staging, [collectGoal(7 * 16, 8 * 16)], DEFAULT_BUDGET, { name: 'C2-turret' });
}
const strip = (o) => JSON.stringify(o, (k, v) => (k === 'ms' || typeof v === 'function' ? undefined : v));
const off = SB.withLatchWeighFirst(false, go);
SB.resetLatchWeighFirstCounts();
const on = SB.withLatchWeighFirst(true, go);
console.log('OFF', off.verdict, (off.refusal ?? off.message ?? '').toString().slice(0, 300));
console.log('verbs', JSON.stringify((off.trace?.rows ?? off.rows ?? []).map((r) => r.strategy?.verb).filter(Boolean)));
console.log('same', strip(on) === strip(off), 'asked', JSON.stringify(SB.LATCH_WEIGH_FIRST_COUNTS.asked));
