const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain, atlasOf } = await import(M + 'procgenLevel.js');
const { DEFAULT_BUDGET, GENERATED_BOOT_TIME, bootStaging, collectGoal, solve } = await import(M + 'procgenOracle.js');
const { POST_SWORD_ITEMS } = await import(M + 'procgenPalette.js');
const { SEEDLING_DEFAULTS } = await import(M + 'procgenSeedling.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { createRunForStaging, solveStaging } = await import(M + 'tapeRunner.js');
const { withIceTurretStaticKill, ICETURRET_STATIC_KILL_COUNTS, resetIceTurretStaticKillCounts } = await import(M + 'solverBot.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { dangerAt } = await import(M + 'dangerMap.js');
const { playerBoxAt } = await import(M + 'playerPhysicsV2.js');
function corridorRoom(cls, rows) {
  let rec = emptyLevel({ level: SEEDLING_DEFAULTS.level });
  const floor = new Set();
  for (let y = 1; y <= rows; y += 1) for (let x = 1; x <= 8; x += 1) floor.add(`${x},${y}`);
  for (let y = 1; y <= 8; y += 1) floor.add(`8,${y}`);
  const wall = [];
  for (let ty = 1; ty <= 8; ty += 1) for (let tx = 1; tx <= 8; tx += 1) if (!floor.has(`${tx},${ty}`)) wall.push({ tx, ty, terrain: 'wall' });
  rec = withTerrain(rec, wall);
  return withEntities(rec, [{ type: SEEDLING_DEFAULTS.goalClass, ...oelAtTile(8, 8), attrs: { tag: SEEDLING_DEFAULTS.goalTag } }, { type: cls, ...oelAtTile(4, 1) }]);
}
const stagingOf = (rec) => bootStaging({ boot: bootAtTile(rec, 1, 1), items: POST_SWORD_ITEMS, pins: ['dead_frames'], time: GENERATED_BOOT_TIME });
for (const rows of [1, 2]) for (const key of [false, true]) for (const icest of [false, true]) {
  const rec = corridorRoom('iceturret', rows);
  resetIceTurretStaticKillCounts();
  const out = withContactFidelity({ turretSnapPricing: key }, () => withIceTurretStaticKill(icest, () => solve(rec, stagingOf(rec), [collectGoal(128, 128)], DEFAULT_BUDGET, { name: 'd2', scratchPersistence: true })));
  const kill = (out.records ?? []).find((r) => r.arm === 'iceturret');
  console.log(`rows ${rows} key ${key ? 'ON ' : 'OFF'} icest ${icest ? 'ON ' : 'OFF'}: ${out.verdict} ticks ${out.ticks ?? '-'} handed ${JSON.stringify(ICETURRET_STATIC_KILL_COUNTS.handed)} kills ${JSON.stringify(ICETURRET_STATIC_KILL_COUNTS.kills)}${kill ? ` stance ${JSON.stringify(kill.stance)} side ${kill.side}` : ''}`);
  if (out.reasonText) console.log('   ' + out.reasonText.split('\n').slice(0, 3).join(' | ').slice(0, 400));
}
// the danger probe at ICEST's stance (88,18) and the corridor lattice centre (y 24), at the boot
for (const key of [false, true]) {
  const rec = corridorRoom('iceturret', 1);
  const run = createRunForStaging(solveStaging(stagingOf(rec)), levelSourceFromAtlas(atlasOf(rec)), { scratchPersistence: true });
  withContactFidelity({ turretSnapPricing: key }, () => {
    for (const [x, y] of [[88, 18], [88, 20], [88, 21], [88, 24], [56, 24], [120, 24]]) {
      const d = dangerAt(run, run.ticksCompleted, playerBoxAt(x, y));
      console.log(`key ${key ? 'ON ' : 'OFF'} dangerAt (${x},${y}) box ${JSON.stringify(playerBoxAt(x, y))}: ${d.sources.map((s) => s.id).join(',') || 'calm'}`);
    }
  });
}
