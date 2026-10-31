const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { plannerObstacleAt } = await import(M + 'botDriverV2.js');
const { l40PocketBootTape } = await import(M + 'fidelityCorpseBump.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const boot = await l40PocketBootTape();
const run = createRunForStaging(stagingFromTape(parseTape(JSON.stringify(boot))), atlasLevelSource());
let s = '';
for (let y = 360; y <= 480; y += 4) {
  let row = String(y).padStart(4) + ' ';
  for (let x = 440; x <= 536; x += 4) { const o = plannerObstacleAt(run.world, x, y, null, {}); row += o ? (o.kind?.[0] ?? '#') : '.'; }
  s += row + '\n';
}
console.log('x from 440 step 4'); console.log(s);
console.log(JSON.stringify(plannerObstacleAt(run.world, 488, 400, null, {})));
