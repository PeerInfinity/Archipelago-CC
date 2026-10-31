const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { playerBoxAt } = await import(M + 'playerPhysicsV2.js');
const { staticEnemyDanger, dangerVolumes } = await import(M + 'dangerMap.js');
const { contactRect } = await import(M + 'combat.js');
const { l40PocketBootTape } = await import(M + 'fidelityCorpseBump.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { plannerObstacleAt } = await import(M + 'botDriverV2.js').catch(() => ({}));
console.log('player box at (488,464)', playerBoxAt(488, 464));
const boot = await l40PocketBootTape();
const run = createRunForStaging(stagingFromTape(parseTape(JSON.stringify(boot))), atlasLevelSource());
const id = 'iceturret@472,400';
const inst = run.worldFor(40).combat.enemies.find((e) => `${e.tag}@${e.x},${e.y}` === id);
console.log('placement contactRect', contactRect(inst), 'cx,cy', inst.cx, inst.cy);
for (let t = 0; t < 4; t += 1) {
  const tt = run.entities('turrets').get(id);
  console.log('t', run.ticksCompleted, 'run turret', tt.x, tt.y, JSON.stringify(tt.rect));
  run.advance(new Set());
}
const tt = run.entities('turrets').get(id);
// strips
for (const [name, y] of [['below-strip', 0], ['above', 0]]) {}
const W = run.worldFor(40);
// terrain column x=488, y 380..470
const solids = await import(M + 'levelWorld.js').catch(() => null);
for (let y = 376; y <= 472; y += 8) {
  const d = staticEnemyDanger(run, playerBoxAt(488, y)).map((d) => d.id);
  console.log('y', y, 'box', JSON.stringify(playerBoxAt(488, y)), 'staticEnemyDanger', d.join(','));
}
console.log('dangerVolumes turret rows', dangerVolumes(run, 0).filter((v) => v.id === id));
