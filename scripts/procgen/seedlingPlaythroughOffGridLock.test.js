/**
 * ⛓ RULES l66-door — an ITEM-GATED SOLID THAT CLAIMS NO WHOLE TILE still costs the door under it.
 *
 * `entitySealedTiles` claims a tile only when the hitbox covers it completely (the planttorch rounding law), which
 * left L66's `bosslock@72,64 {keyType 4}` with NO tile: it fills building8's doorway notch half a tile off the grid
 * (`Puzzlements/BossLock.as:29-36`, `Building8Mask.png` x 72-87). The grid never carried its key, `chargeSealedDoor`
 * never saw `out_teleporter_72_64` as sealed, and the only door into Dungeon 6 shipped True_. The game refuses it
 * without the Yellow Key (`probe-seedling-l66-door.mjs`, the game pin).
 *
 * The census here is computed from `ENTITY_SEMANTICS` + `entitySealedTiles` directly, not through
 * `offGridGatedSolids`, so a regression that skips such an entity again reds a row instead of agreeing with itself.
 * Each row BUILDS the atlas fresh.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    buildPlaythroughAtlas, sealedDoorsCharged, offGridGatedSolids, playthroughGridFor, playthroughAnalyzerOptions,
    PLAYTHROUGH_MAP,
} from './make-seedling-playthrough-rules.mjs';
import {
    entitySemantics, entitySealedTiles, entityFootprint, conditionKey,
} from '../../frontend/modules/flashPanel/seedlingSemantics.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const YELLOW = { rule: 'Has', args: { item_name: 'Yellow Key' } };

let atlas;
beforeAll(() => { atlas = buildPlaythroughAtlas(); }, 120_000);

/** Every gated entity with a condition that claims no whole tile, read straight off the semantics. */
function census() {
    const out = [];
    for (const level of PLAYTHROUGH_MAP.levels) {
        for (const entity of level.entities ?? []) {
            const sem = entitySemantics(entity);
            if (sem?.kind !== 'gated' || !sem.condition) continue;
            if (entitySealedTiles(entity, sem).length > 0) continue;
            const f = entityFootprint(entity, sem);
            const tiles = [];
            for (let ty = f.y; ty < f.y + f.h; ty += 1) for (let tx = f.x; tx < f.x + f.w; tx += 1) tiles.push([tx, ty]);
            out.push({ level, entity, sem, tiles });
        }
    }
    return out;
}
const containsRule = (rule, want) => JSON.stringify(rule ?? null).includes(JSON.stringify(want));

describe('a gated solid that claims no whole tile is never skipped', () => {
    it('the census is measured, not assumed: today exactly L66 bosslock@72,64, over tiles [4,4] and [5,4]', () => {
        expect(census().map((c) => `L${c.level.level} ${c.entity.type}@${c.entity.x},${c.entity.y} ${JSON.stringify(c.tiles)}`))
            .toEqual(['L66 bosslock@72,64 [[4,4],[5,4]]']);
    });

    it('the producer stamps every one of them: each non-open footprint cell carries the entity\'s condition', () => {
        const missed = [];
        for (const { level, entity, sem, tiles } of census()) {
            expect(offGridGatedSolids(level).map((s) => s.entity)).toContain(entity);
            const grid = playthroughGridFor(level);
            for (const [tx, ty] of tiles) {
                const cell = grid.cells[ty * grid.width + tx];
                if (cell.kind === 'open') continue;
                if (!cell.conditions.some((c) => conditionKey(c) === conditionKey(sem.condition))) {
                    missed.push(`L${level.level} [${tx},${ty}] (${cell.kind}) lacks ${conditionKey(sem.condition)}`);
                }
            }
        }
        expect(missed).toEqual([]);
    });

    it('every DEPARTURE under one of them is charged its condition in the atlas', () => {
        const uncharged = [];
        for (const { level, entity, sem, tiles } of census()) {
            const region = atlas.regions.find((r) => r.map_ref === level.level);
            const want = playthroughAnalyzerOptions.resolveCondition(sem.condition);
            for (const exit of region.exits.filter((e) => e.exit_id.startsWith('out_'))) {
                const t = exit.entrance_tile ?? exit.exit_tiles[0];
                if (!tiles.some(([x, y]) => x === t[0] && y === t[1])) continue;
                if (!containsRule(exit.access_rule, want)) uncharged.push(`${region.region_id}/${exit.exit_id} under ${entity.type}@${entity.x},${entity.y}`);
            }
        }
        expect(uncharged).toEqual([]);
    });

    it('the rounding law holds: an OPEN cell in such a footprint gains nothing (the player\'s box goes round)', () => {
        for (const { level, sem, tiles } of census()) {
            const grid = playthroughGridFor(level);
            for (const [tx, ty] of tiles) {
                const cell = grid.cells[ty * grid.width + tx];
                if (cell.kind !== 'open') continue;
                expect(cell.conditions.map(conditionKey)).not.toContain(conditionKey(sem.condition));
            }
        }
    });
});

describe('L66: the only door into Dungeon 6 costs the Yellow Key', () => {
    it('the atlas charges out_teleporter_72_64 Has(Yellow Key), as a sealed door', () => {
        const exit = atlas.regions.find((r) => r.region_id === 'level_66').exits.find((e) => e.exit_id === 'out_teleporter_72_64');
        expect(exit.access_rule).toEqual(YELLOW);
        expect(sealedDoorsCharged).toContain('level_66/out_teleporter_72_64');
    });

    it('the committed AP_1 rules carry it: level_66__r5c4 -> level_70 = Has(Yellow Key)', () => {
        const rules = JSON.parse(readFileSync(join(REPO, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
        const exit = rules.regions['1'].level_66__r5c4.exits.find((e) => e.connected_region === 'level_70');
        expect(exit.access_rule).toEqual(YELLOW);
    });
});
