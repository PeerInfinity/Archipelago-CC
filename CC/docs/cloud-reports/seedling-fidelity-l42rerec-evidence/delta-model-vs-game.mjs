// Max |Δ| between the model's replay of a committed tape and its game-recorded oracle stream.
// node CC/docs/cloud-reports/seedling-fidelity-l42rerec-evidence/delta-model-vs-game.mjs <tape-name>...
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const M = join(process.cwd(), 'frontend', 'modules', 'seedlingDemo');
const { parseTape } = await import(join(M, 'tapeFormat.js'));
const { runTape } = await import(join(M, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(M, 'levelSource.js'));
for (const name of process.argv.slice(2)) {
    const tape = parseTape(JSON.parse(readFileSync(join(M, 'fixtures', 'tapes', `${name}.json`), 'utf8')));
    const oracle = JSON.parse(readFileSync(join(M, 'fixtures', 'expectations', `${name}.json`), 'utf8'));
    const out = runTape(tape, { levelSource: atlasLevelSource() });
    const byT = new Map(out.ticks.map((o) => [o.t, o]));
    let max = 0; let at = null; let n = 0; let missing = 0; let lvl = 0;
    for (const g of oracle.ticks) {
        const m = byT.get(g.t); if (!m) { missing += 1; continue; }
        n += 1; if (m.level !== g.level) lvl += 1;
        const d = Math.max(Math.abs(m.x - g.x), Math.abs(m.y - g.y));
        if (d > max) { max = d; at = g.t; }
    }
    console.log(`${name}: ${n} observations compared (${out.ticks.length} model / ${oracle.ticks.length} game), `
        + `${missing} missing, ${lvl} level mismatches, max |Δ| = ${max} px${at !== null ? ` at t${at}` : ''}, `
        + `model hits ${out.playerHits.length}`);
}
