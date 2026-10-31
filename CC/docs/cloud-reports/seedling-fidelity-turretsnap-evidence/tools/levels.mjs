const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { l40PocketBootTape } = await import(M + 'fidelityCorpseBump.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { iceTurretRect } = await import(M + 'iceTurret.js');
const boot = await l40PocketBootTape();
const run = createRunForStaging(stagingFromTape(parseTape(JSON.stringify(boot))), atlasLevelSource());
for (let L = 1; L <= 130; L += 1) {
  let w; try { w = run.worldFor(L); } catch { continue; }
  if (!w) continue;
  const tur = (w.combat?.enemies ?? []).filter((e) => e.tag === 'iceturret');
  if (!tur.length) continue;
  const poles = (w.pressResponders ?? []).map((r) => r.tag).filter((t) => /pole/i.test(String(t))).length + (w.pressResponders ?? []).length * 0; const tags = [...new Set((w.pressResponders ?? []).map((r) => r.tag))].join("/");
  const arrows = (w.combat?.hazards ?? []).filter((h) => /arrow/.test(h.tag)).length;
  console.log('L' + L, tur.map((e) => {
    const s = { dead: false, x: e.cx, y: e.cy };
    const fx = (v) => Math.floor(v / 16) * 16 + 8;
    return `${e.tag}@${e.x},${e.y} ctor(${e.cx},${e.cy}) snap(${fx(e.cx)},${fx(e.cy)})`;
  }).join(' '), 'poles', poles, "responders", tags, "arrowtraps", arrows);
}
