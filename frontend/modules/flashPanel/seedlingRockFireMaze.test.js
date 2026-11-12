/**
 * ⛓⛓ tile-fire-breaks-rocks — the maze's side of "Fire breaks rocks": a level world's rock row gains a Fire strike FROM
 * THE RULES' OWN STANCES (`seedlingRockBreakers.rockFireSides`, the census the overlay's `rockFireRuling` reads), so maze and
 * rules read one stance set; the engine strikes it from those stances only (per-action `struck_from`).
 *
 * MUTATIONS (each reds the named row):
 *   m1 `seedlingLevelEntities` ignores `rockFire`                    -> "an ordinary rock with a clean stance gains Fire…"
 *   m2 the Fire stances at one facing only                            -> "…every facing"
 *   m3 `doorLandingTiles` drops a door (e.g. the `playerx` test)      -> "the door landings are gameLandings' tiles"
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildLevelWorld, ROLES } from '../seedlingDemo/levelWorld.js';
import { auditFire } from '../seedlingDemo/presses.js';
import { plannerObstacleAt } from '../seedlingDemo/botDriverV2.js';
import { gameLandings } from '../seedlingDemo/fidelityArrival.js';
import { rockFireSides, doorLandingTiles } from './seedlingRockBreakers.js';
import { seedlingLevelEntities, seedlingAnalyzerOptions } from './seedlingAtlasAnalysis.js';
import { buildSeedlingRegionGrid } from './seedlingSemantics.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(HERE, p), 'utf8'));
const MAP = read('atlases/seedling-map.json');
const OPTIONS = seedlingAnalyzerOptions(read('games/seedling.json'));
const MODEL = Object.freeze({ buildLevelWorld, ROLES, auditFire, plannerObstacleAt });
const LANDINGS = doorLandingTiles(MAP.levels);
const levelsWithRocks = MAP.levels.filter((l) => (l.entities ?? []).some((e) => e.type === 'breakablerock'));
const entitiesOf = (level) => {
    const fire = rockFireSides(level, MODEL, { arrivalTiles: LANDINGS.get(level.level) ?? [] });
    const grid = buildSeedlingRegionGrid({ x: 0, y: 0, w: level.width, h: level.height }, level);
    return { fire, rows: seedlingLevelEntities(level, OPTIONS.resolveCondition, { grid, rockFire: fire }) };
};
const fireStrike = (row) => (row.strike ?? []).find((s) => s.action === 'fire');

describe('tile-fire-breaks-rocks — the door landings the census reads', () => {
    it("the door landings are gameLandings' tiles, level by level", () => {
        const expected = new Map();
        for (const g of gameLandings(MAP)) {
            if (!expected.has(g.level)) expected.set(g.level, []);
            expected.get(g.level).push([Math.floor(g.x / 16), Math.floor(g.y / 16)]);
        }
        expect(LANDINGS.size).toBe(expected.size);
        for (const [level, tiles] of expected) expect(LANDINGS.get(level), `L${level}`).toEqual(tiles);
    });
});

describe('tile-fire-breaks-rocks — a level world rock row and its Fire strike', () => {
    it('an ordinary rock with a clean stance gains Fire from those stances only; one without keeps the swing', () => {
        let withFire = 0;
        let without = 0;
        for (const level of levelsWithRocks) {
            const { fire, rows } = entitiesOf(level);
            for (const row of rows.filter((r) => r.kind === 'rock' && r.label.startsWith('breakablerock@'))) {
                const census = fire.get(row.label);
                const strike = fireStrike(row);
                if (census.stances.length === 0) {
                    expect(strike, `L${level.level} ${row.label}`).toBeUndefined();
                    without += 1;
                    continue;
                }
                withFire += 1;
                expect(strike.item, row.label).toBe('Fire');
                const tiles = new Set(strike.stances.map(([x, y]) => `${x},${y}`));
                expect([...tiles].sort(), `L${level.level} ${row.label}`).toEqual(census.stances.map((s) => `${s.tx},${s.ty}`).sort());
                // the swing still strikes through the cell: it carries no stances
                expect(row.strike.filter((s) => s.action !== 'fire').every((s) => s.stances === undefined)).toBe(true);
            }
        }
        // both kinds exist in the map (L40/L41 have no clean stance; L0 has three with one)
        expect(withFire > 0 && without > 0).toBe(true);
    });

    it('…every facing: the flame has no aim (Player.as:1015-1035)', () => {
        const { rows } = entitiesOf(MAP.levels.find((l) => l.level === 0));
        const strike = fireStrike(rows.find((r) => r.label === 'breakablerock@80,112'));
        const byTile = new Map();
        for (const [x, y, f] of strike.stances) byTile.set(`${x},${y}`, [...(byTile.get(`${x},${y}`) ?? []), f]);
        for (const facings of byTile.values()) expect(facings.sort()).toEqual(['E', 'N', 'S', 'W']);
    });

    it('a ghost rock never gains Fire (rockType 1 > the flame\'s hit power)', () => {
        for (const level of levelsWithRocks.concat(MAP.levels.filter((l) => (l.entities ?? []).some((e) => e.type === 'breakablerockghost')))) {
            const { rows } = entitiesOf(level);
            for (const row of rows.filter((r) => r.label.startsWith('breakablerockghost@'))) expect(fireStrike(row)).toBeUndefined();
        }
    });
});
