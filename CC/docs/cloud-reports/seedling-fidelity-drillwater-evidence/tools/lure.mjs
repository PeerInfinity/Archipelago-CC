// scratch: try a scripted waypoint walk on the model (drillTerrainSwitch ON), print drill events + hits.
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { ropeStaging } = await import(M + 'fidelityRope.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { createRunForStaging } = await import(M + 'tapeRunner.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const [bx, by] = process.argv[2].split(',').map(Number);
const path = JSON.parse(process.argv[3]);
const ticks = Number(process.argv[4] ?? 200);
const sw = { drillMixedRooms: true, drillTerrainSwitch: process.env.OFF ? false : true };
const staging = await ropeStaging({ boot: { level: 91, x: bx, y: by }, items: ['hasSpear', 'canSwim'], persistence: [] });
withContactFidelity(sw, () => {
  const run = createRunForStaging(staging, atlasLevelSource());
  let wi = 0; const keys = [];
  try {
    for (let i = 0; i < ticks; i++) {
      const to = path[Math.min(wi, path.length - 1)];
      const k = new Set(); const dx = to[0] - run.state.x, dy = to[1] - run.state.y;
      if (dx < -2) k.add('left'); if (dx > 2) k.add('right'); if (dy < -2) k.add('up'); if (dy > 2) k.add('down');
      if (k.size === 0 && wi < path.length - 1) wi++;
      keys.push([...k]); run.advance(k);
      if (i % 10 === 0 || i === ticks - 1) console.log(i + 1, 'p', run.state.x.toFixed(2), run.state.y.toFixed(2), 'hits', run.damage.hits,
        JSON.stringify(run.drills.bodies.map((d) => [d.x, d.y, d.anim, d.destroy, d.removed, +(d.alpha ?? 1).toFixed(2)])));
    }
  } catch (e) { console.log('THROW', e.message.slice(0, 300)); }
  console.log('events', JSON.stringify(run.drills.events.filter((e) => e.kind !== 'contact')));
  console.log('contacts', JSON.stringify(run.drills.events.filter((e) => e.kind === 'contact').map((e) => e.t)));
});
