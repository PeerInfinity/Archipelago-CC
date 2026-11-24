// Measure: per LavaTrap, the pull disc cells (tile centres) whose `collideLine("Solid")` to the trap's centre hits a
// pixel solid of the physics model (`buildLevelWorld(level).solidBoxesForMover()`, `crusher.collideLineSolid`), vs the
// grid-wall test. The player stands with its centre on the tile centre (the pull's own measure).
import { PLAYTHROUGH_MAP, playthroughGridFor } from '../../../../../scripts/procgen/make-seedling-playthrough-rules.mjs';
import * as OV from '../../../../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';
import { buildLevelWorld } from '../../../../../frontend/modules/seedlingDemo/levelWorld.js';
import { collideLineSolid } from '../../../../../frontend/modules/seedlingDemo/crusher.js';
const levels = PLAYTHROUGH_MAP.levels ?? PLAYTHROUGH_MAP;
for (const level of levels) {
    const pulls = OV.lavaTrapPulls(level, 16, { solid: null });
    if (!pulls.length) continue;
    const g = playthroughGridFor(level);
    const solids = buildLevelWorld(level).solidBoxesForMover();
    for (const p of pulls) {
        const ti = p.tile[1] * g.width + p.tile[0];
        const c = [p.tile[0] * 16 + 8, p.tile[1] * 16 + 8];
        const grid = p.from.filter(([x, y]) => !OV.pullLineClear([x, y], p.tile, 16, (a, b) => g.cells[b * g.width + a]?.kind === 'wall')).map(String);
        const pix = p.from.filter(([x, y]) => collideLineSolid(solids, c[0], c[1], x * 16 + 8, y * 16 + 8) !== null).map(String);
        const hit = (x, y) => { const s = collideLineSolid(solids, c[0], c[1], x * 16 + 8, y * 16 + 8); return s ? `${s.tag ?? s.id ?? 'solid'}@${s.x},${s.y}` : ''; };
        console.log(`L${level.level} trap (${p.tile}): grid-cut [${grid.join(' ')}]  pixel-cut [${p.from.filter(([x,y])=>pix.includes(`${x},${y}`)).map(([x,y])=>`(${x},${y}) by ${hit(x,y)} kind=${g.cells[y*g.width+x].kind}`).join('; ')}]`);
    }
}
