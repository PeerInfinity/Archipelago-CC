import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseTape } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/tapeFormat.js';
import { createTapeStepper } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/tapeRunner.js';
import { atlasLevelSource } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/levelSource.js';
import { withContactFidelity } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/contactFidelity.js';
for (const p of process.argv.slice(2)) {
  const row = {};
  for (const lapse of [false, true]) {
    const rows = [];
    withContactFidelity({ strikeIframeLapse: lapse }, () => {
      let run = null;
      const st = createTapeStepper(parseTape(readFileSync(p, 'utf8')), { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
      for (let r = st.next(); !r.done; r = st.next()) {
        const o = r.value.observation; const b = (run?.entities('chasers') ?? []).find((c) => c.id === 'bobsoldier@48,80');
        rows.push([o.t, o.x, o.y, o.level, b ? [b.x, b.y, b.hits, b.hitsTimer, !!b.destroy] : null]);
      }
    });
    row[lapse ? 'on' : 'off'] = createHash('md5').update(JSON.stringify(rows)).digest('hex') + ' n=' + rows.length;
  }
  console.log(p.split('/').slice(-2).join('/'), JSON.stringify(row), row.on === row.off ? 'IDENTICAL' : 'DIFFER');
}
