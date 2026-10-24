// AXEFORCEDU copy of AXETIMING's drivers/cmp.mjs.
// model replay of a tape vs the game's rows (game.mjs): worst |Δ| over the ticks both have, and the model's billed hits
import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createTapeStepper } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const g = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const on of [false, true]) {
  withContactFidelity({ spinningAxePlayerHit: on }, () => {
    let run = null; const col = [];
    const st = createTapeStepper(parseTape(JSON.stringify(g.tape)), { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    let r = st.next(); while (!r.done) { col[r.value.observation.t] = r.value.observation; r = st.next(); }
    let worst = 0, n = 0, first = null;
    for (const row of g.rows) { const m = col[row.t]; if (!m) continue; n++; const d = Math.max(Math.abs(m.x - row.x), Math.abs(m.y - row.y)); if (d > worst) worst = d; if (d > 0 && first === null) first = row.t; }
    console.log(`axeHit ${on ? 'ON ' : 'OFF'}: ${n} ticks compared, worst |Δ| ${worst}, first parting ${first ?? 'none'}; model hits [${run.playerHits.map((h) => `t${h.t} ${h.source} ${h.id}`).join(', ')}]; game hits ${[...new Set(g.rows.map((x) => x.hits))].join('/')}`);
  });
}
