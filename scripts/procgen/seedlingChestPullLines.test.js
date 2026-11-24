/**
 * ⛓ rules-ap-chest-solid — PIN (B): **NO AP CHEST CELL LIES ON ANY LAVATRAP'S LINE SET.**
 *
 * An AP chest is `type = "Solid"` while shut (`Pickups/APChest.as:57`) and a LavaTrap launches only on a clear
 * `collideLine("Solid", trap, player)` (`LavaTrap.as:86-88`), so a SHUT chest would cut a pull line. The producer's disc
 * (`playthroughLavaTrapPulls`) cuts only at the grid's `wall` cells and the chest's cell is `directional`, so it reads every
 * chest as OPEN (`type = ""`, `APChest.as:89`). The two readings agree exactly when no chest cell lies on any line the
 * disc tests. This row measures that over every LavaTrap of the playthrough map, for every tile of its UNCUT disc, with the
 * line test the disc itself uses (`pullLineClear`), so the pin covers BOTH the shut and the opened chest. The chests are the
 * entities the playthrough overlay rules a one-sided Solid (`probe`, no condition), placed by their hitbox, so a level
 * edit that puts a chest on a line (or a trap beside a chest) reds it. No level literal.
 */
import { describe, expect, it } from 'vitest';

import { PLAYTHROUGH_MAP, playthroughEntitySemantics, playthroughLavaTrapPulls } from './make-seedling-playthrough-rules.mjs';
import * as OV from '../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';

const TILE = PLAYTHROUGH_MAP.tile_size;

/** Every tile an AP chest's box touches (off-grid boxes touch several). */
function chestTilesOf(level) {
    const out = new Set();
    for (const e of level.entities ?? []) {
        const sem = playthroughEntitySemantics(e, level);
        if (!(sem?.kind === 'directional' && sem.probe && !sem.condition && !sem.opensFrom)) continue;
        const box = sem.hitbox ?? { left: 0, top: 0, w: TILE, h: TILE };
        for (let y = e.y + box.top; y < e.y + box.top + box.h; y += 1) {
            for (let x = e.x + box.left; x < e.x + box.left + box.w; x += 1) out.add(`${Math.floor(x / TILE)},${Math.floor(y / TILE)}`);
        }
    }
    return out;
}

describe('PIN (B) — no AP chest cell lies on any LavaTrap line (the shut and the opened chest read alike)', () => {
    const trapLevels = PLAYTHROUGH_MAP.levels.filter((l) => (l.entities ?? []).some((e) => e.type === OV.LAVATRAP_PULL.tag));

    it('the measurement has subjects: trap levels, and a trap level that holds a chest', () => {
        expect(trapLevels.length).toBeGreaterThan(0);
        expect(trapLevels.some((l) => chestTilesOf(l).size > 0)).toBe(true);
        // the chest reader is the overlay's: every map chest is one, and nothing else is
        const all = PLAYTHROUGH_MAP.levels.reduce((n, l) => n + chestTilesOf(l).size, 0);
        expect(all).toBeGreaterThanOrEqual(PLAYTHROUGH_MAP.levels.flatMap((l) => l.entities ?? []).filter((e) => e.type === 'chest').length);
    });

    it('every line from every uncut disc tile to its trap is clear of every chest tile', () => {
        const hits = [];
        for (const level of trapLevels) {
            const chests = chestTilesOf(level);
            if (chests.size === 0) continue;
            const onChest = (x, y) => chests.has(`${x},${y}`);
            for (const pull of OV.lavaTrapPulls(level, TILE, { solid: null })) {
                if (chests.has(`${pull.tile[0]},${pull.tile[1]}`)) hits.push(`L${level.level} trap (${pull.tile}) stands on a chest`);
                for (const t of pull.from) {
                    if (chests.has(`${t[0]},${t[1]}`)) hits.push(`L${level.level} trap (${pull.tile}): disc tile (${t}) is a chest`);
                    else if (!OV.pullLineClear(t, pull.tile, TILE, onChest)) hits.push(`L${level.level} trap (${pull.tile}): the line from (${t}) crosses a chest`);
                }
            }
        }
        expect(hits).toEqual([]);
    });

    it('so the producer\'s disc is the same with every chest cell counted as "Solid"', () => {
        for (const level of trapLevels) {
            const chests = chestTilesOf(level);
            const shut = OV.lavaTrapPulls(level, TILE, { solid: null })
                .map((p) => ({ tile: p.tile, from: p.from.filter((t) => OV.pullLineClear(t, p.tile, TILE, (x, y) => chests.has(`${x},${y}`))) }));
            for (const p of playthroughLavaTrapPulls(level)) {
                const s = shut.find((q) => q.tile[0] === p.tile[0] && q.tile[1] === p.tile[1]);
                // every tile of the producer's (wall-cut) disc keeps a chest-clear line
                for (const t of p.from) expect(s.from.some((u) => u[0] === t[0] && u[1] === t[1]), `L${level.level} (${t})`).toBe(true);
            }
        }
    });

    it('MUTANT: a chest planted on a trap\'s line IS caught by the same test', () => {
        const level = trapLevels[0];
        const pull = OV.lavaTrapPulls(level, TILE, { solid: null })[0];
        // a disc tile two steps from the trap along an axis has the cell between them on its line
        const far = pull.from.find((t) => Math.abs(t[0] - pull.tile[0]) + Math.abs(t[1] - pull.tile[1]) === 2 && (t[0] === pull.tile[0] || t[1] === pull.tile[1]));
        expect(far).toBeTruthy();
        const mid = [(far[0] + pull.tile[0]) / 2, (far[1] + pull.tile[1]) / 2];
        expect(OV.pullLineClear(far, pull.tile, TILE, (x, y) => x === mid[0] && y === mid[1])).toBe(false);
    });
});
