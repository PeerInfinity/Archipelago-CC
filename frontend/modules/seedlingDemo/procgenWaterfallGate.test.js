/**
 * seedlingDemo — **THE WATERFALL GATE, AND THE FEATHER IS WHAT OPENS IT**
 * (seedling swim T2, D3).
 *
 * One `TERRAIN.waterfall` cell on a main-path cut whose START side is the cell
 * BELOW it (`soloDoor.WATERFALL_GATE`, `approach: 'south'`). `Player.input()`
 * adds 0.8 to `v.y` on a waterfall unless the feather is held and the player
 * moves up, and the waterfall's swim speed is below 0.8, so without the
 * feather the climb stalls on the face; the planner's directed edge rule
 * (`botDriverV2.climbsArmedWaterfall`) refuses it, and since D3 the refusal
 * says so. ⛔ It is not a death: `checkDrowning` tests water (type 1), not the
 * waterfall (type 25).
 *
 * ⛓ THE WITNESS, measured at T2's D3 (scratch `why.mjs`): `winding` 10x10,
 * seed 8, `post-feather`, bounds 3/4/3 — the door at (3,2), CERTIFIED SOLVED
 * 139 ticks; the differential grades the feather STRONG (without it REFUSED,
 * the climb rule named), the conch INERT (a waterfall does not drown).
 *
 * ⛔ MUTANT (c) — the south-approach check dropped — lets a door entered from
 * ABOVE place (`soloDoor.test.js`' three corridor rows red).
 */

import { describe, expect, it } from 'vitest';

import { generateSeedlingLevel, seedlingSkeletonSpec } from './procgenSeedling.js';
import {
    DOOR_TERRAIN, WATER_DOOR_IDS, seedlingOnConnectorEntities,
} from './procgenSeedlingElements.js';
import {
    POST_FEATHER_ITEMS, POST_FEATHER_PALETTE, POST_SWIM_ITEMS, POST_SWIM_PALETTE,
} from './procgenPalette.js';
import { gradeOf, requirementsFor } from './procgenRequirements.js';
import { DEFAULT_BUDGET } from './procgenOracle.js';
import { TERRAIN, recordHoldsWater, terrainAt } from './procgenLevel.js';
import { DEFAULT_CENSUS_BIOMES, GENERATE_BIOMES } from './watchGenerate.js';
import { ELEMENT_TABLE, headsNeeding, parseElementSpec } from '../procgenCore/elementSpec.js';
import { WATERFALL_GATE_DOOR_ID } from '../procgenCore/elements/soloDoor.js';
import { TILE_COLUMN_TO_TYPE } from '../flashPanel/seedlingSemantics.js';

const WITNESS = Object.freeze({ seed: 8, kind: 'winding', size: 10 });
const BOUNDS = Object.freeze({ obstacleTarget: 3, triesPerStep: 4, saturationK: 3,
    anchorTriesPerCandidate: 1 });

const generate = (palette) => generateSeedlingLevel({
    seed: WITNESS.seed, palette, bounds: BOUNDS,
    defaults: { width: WITNESS.size, height: WITNESS.size },
    skeleton: seedlingSkeletonSpec(WITNESS.kind),
    elements: parseElementSpec('waterfallgate'),
});

describe('⛓⛓⛓ the waterfall terrain, the table row and the biome (swim T2, D3)', () => {
    it('TERRAIN.waterfall is level 0\'s own column, and it builds type 25', () => {
        expect(TERRAIN.waterfall).toEqual({ name: 'waterfall', column: 32, type: 25 });
        expect(TILE_COLUMN_TO_TYPE[TERRAIN.waterfall.column]).toBe(25);
    });

    it('a record holding only a waterfall owes the `sound` pin', () => {
        const rec = { layers: [{ name: 'tiles', tiles: [[1, 1, TERRAIN.waterfall.column * 16, 0]] }] };
        expect(recordHoldsWater(rec)).toBe(true);
        const dry = { layers: [{ name: 'tiles', tiles: [[1, 1, TERRAIN.ground.column * 16, 0]] }] };
        expect(recordHoldsWater(dry)).toBe(false);
    });

    it('`waterfallgate` needs the feather, and is the only head that does', () => {
        expect(ELEMENT_TABLE.waterfallgate.needs).toEqual(['hasFeather']);
        expect(headsNeeding('hasFeather')).toEqual(['waterfallgate']);
    });

    it('post-feather is post-swim plus the feather, and in the census default (⚖ Q13)', () => {
        expect(POST_FEATHER_ITEMS).toEqual({ ...POST_SWIM_ITEMS, hasFeather: true });
        expect(POST_FEATHER_PALETTE.templates).toBe(POST_SWIM_PALETTE.templates);
        expect(GENERATE_BIOMES['post-feather']).toBe(POST_FEATHER_PALETTE);
        expect(DEFAULT_CENSUS_BIOMES).toContain('post-feather');
    });

    it('the door is TERRAIN: painted `waterfall`, no entity, no tag', () => {
        expect(WATER_DOOR_IDS).toContain(WATERFALL_GATE_DOOR_ID);
        expect(Object.keys(DOOR_TERRAIN).sort()).toEqual([...WATER_DOOR_IDS].sort());
        expect(DOOR_TERRAIN[WATERFALL_GATE_DOOR_ID]).toBe('waterfall');
        const out = seedlingOnConnectorEntities({
            placed: { entities: [{ role: 'obstacle', x: 3, y: 2, id: WATERFALL_GATE_DOOR_ID }] },
            tagFor: () => { throw new Error('a waterfall door spends no tag'); },
        });
        expect(out.entities).toEqual([]);
    });
});

describe('⛓⛓⛓ the WATERFALL GATE on a generated Seedling level (swim T2, D3)', () => {
    it('places a climb, certifies 139 t, and grades the feather STRONG by the CLIMB rule', () => {
        const out = generate(POST_FEATHER_PALETTE);
        expect(out.model.elements.ran).toBe(true);
        const placed = out.model.elements.placed[0];
        expect(placed.family).toBe('waterfallgate');
        expect(placed.doorCell).toEqual({ x: 3, y: 2 });
        expect(terrainAt(out.record, 3, 2)).toBe('waterfall');
        expect(out.summary.pins).toContain('sound');
        expect(out.certification.certified).toBe(true);
        expect(out.summary.finalTicks).toBe(139);

        const rep = requirementsFor({
            record: out.record, model: out.model, palette: POST_FEATHER_PALETTE,
            summary: out.summary, seed: WITNESS.seed, biome: 'post-feather',
        }, { verdict: 'SOLVED', ticks: out.summary.finalTicks }, { budget: DEFAULT_BUDGET });
        const feather = rep.rows.find((r) => r.flag === 'hasFeather');
        expect(gradeOf(feather)).toBe('STRONG');
        expect(feather.withoutVerdict).toBe('REFUSED');
        /** ⛔ REFUSED BY THE CLIMB RULE — not a drown, not a budget */
        expect(feather.withoutReason).toMatch(/UPWARD step\(s\) into or out of an armed waterfall/);
        expect(feather.withoutReason).not.toMatch(/drown/i);
        expect(feather.item).toBe('Progressive Swim ×2');
        /** the conch alone buys nothing here: a waterfall does not drown */
        expect(gradeOf(rep.rows.find((r) => r.flag === 'canSwim'))).toBe('INERT');
    }, 120000);

    it('post-swim (the conch, no feather): the seam refuses BY NAME', () => {
        const out = generate(POST_SWIM_PALETTE);
        expect(out.certification.certified).toBe(false);
        expect(out.certification.reason ?? out.certification.refused?.reason
            ?? JSON.stringify(out.certification))
            .toMatch(/the-element-needs-an-item-this-biome-does-not-grant/);
    }, 120000);
});
