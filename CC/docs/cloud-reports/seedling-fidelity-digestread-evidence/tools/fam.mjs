const { loadTape } = await import(`${process.env.ROOT ?? '/home/user/Archipelago-CC'}/frontend/modules/seedlingDemo/fixtures/index.js`);
const { atlasLevelSource } = await import(`${process.env.ROOT ?? '/home/user/Archipelago-CC'}/frontend/modules/seedlingDemo/levelSource.js`);
const { createRunForStaging, stagingFromTape } = await import(`${process.env.ROOT ?? '/home/user/Archipelago-CC'}/frontend/modules/seedlingDemo/tapeRunner.js`);
const S = stagingFromTape(loadTape('r9-solve-18'));
const src = atlasLevelSource();
const fams = ['crushers','bossTotems','shieldBosses','finalDoors','iceTurrets','pulsers','spinners','fallRocks','magicalLocks','chests','lightsControllers','pushables','bridges','activators','ropes','rocks','trees','arrowTraps'];
const by = {};
for (let level = 0; level < 116; level++) {
  let w; try { w = createRunForStaging({ ...S, boot: { level, x: 160, y: 120 }, persistence: [] }, src).world; } catch (e) { console.log('L', level, e.message.slice(0,50)); continue; }
  for (const f of fams) if (Array.isArray(w[f]) && w[f].length) (by[f] ??= []).push(level);
  if ((w.solids ?? []).some((s) => s.cls?.type === 'LavaBoss')) (by.lavaBoss ??= []).push(level);
  if ((w.fallRocks ?? []).some((r) => r.thirdBoss)) (by.bobArena ??= []).push(level);
  if (level === 0) console.log(Object.keys(w).filter((k) => Array.isArray(w[k])).join(' '));
}
for (const [k, v] of Object.entries(by)) console.log(k.padEnd(18), v.join(' '));
