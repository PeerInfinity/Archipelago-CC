// Measure: per LavaTrap, the pull disc cells whose centre-to-centre line to the trap crosses a grid `wall` cell
// (the producer's grid, the cells rule T's `trapTongueCells` stood `collideLine("Solid")` with). Prints a picture.
import { PLAYTHROUGH_MAP, playthroughGridFor } from '../../../../../scripts/procgen/make-seedling-playthrough-rules.mjs';
import * as OV from '../../../../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';
const levels = PLAYTHROUGH_MAP.levels ?? PLAYTHROUGH_MAP;
for (const level of levels) {
    const pulls = OV.lavaTrapPulls(level, 16, { solid: null });
    if (!pulls.length) continue;
    const variants = { default: playthroughGridFor(level), guardsOff: playthroughGridFor(level, { guards: false }), noDir: playthroughGridFor(level, { directionalLocks: null }), kinds: playthroughGridFor(level, { arrivals: false }) };
    const g = variants.default;
    const wallsOf = (gr) => gr.cells.map((c, i) => (c.kind === 'wall' ? i : -1)).filter((i) => i >= 0).join(',');
    const same = Object.entries(variants).map(([k, v]) => `${k}=${wallsOf(v) === wallsOf(g) ? 'same' : 'DIFF'}`).join(' ');
    console.log(`L${level.level} ${level.width}x${level.height} walls across grid variants: ${same}`);
    for (const p of pulls) {
        const ti = p.tile[1] * g.width + p.tile[0];
        const cut = p.from.filter(([x, y]) => !OV.pullLineClear([x, y], p.tile, 16, (a, b) => g.cells[b * g.width + a]?.kind === 'wall'));
        const kind = ([x, y]) => g.cells[y * g.width + x].kind;
        console.log(`  trap (${p.tile}) from ${p.from.length}; cut ${cut.length}: ${cut.map((c) => `(${c})${kind(c)}`).join(' ')}; yields ${JSON.stringify(p.yields)}`);
        for (let y = p.tile[1] - 3; y <= p.tile[1] + 3; y += 1) {
            let row = '    ';
            for (let x = p.tile[0] - 3; x <= p.tile[0] + 3; x += 1) {
                if (x < 0 || y < 0 || x >= g.width || y >= g.height) { row += ' '; continue; }
                const c = g.cells[y * g.width + x];
                const inD = p.from.some((t) => t[0] === x && t[1] === y);
                const isCut = cut.some((t) => t[0] === x && t[1] === y);
                row += x === p.tile[0] && y === p.tile[1] ? 'T' : isCut ? 'X' : c.kind === 'wall' ? '#' : inD ? (c.kind === 'open' ? 'o' : c.kind[0].toUpperCase()) : (c.kind === 'open' ? '.' : c.kind[0]);
            }
            console.log(row);
        }
    }
}
