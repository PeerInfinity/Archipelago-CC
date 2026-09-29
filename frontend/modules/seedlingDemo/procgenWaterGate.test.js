/**
 * seedlingDemo — **THE WATER GATE: one water cell on a cut, crossed with the
 * conch** (seedling swim S1, D3).
 *
 * The rock gate's geometry (`soloDoor.buildSoloDoor`, law `cut`) with the
 * obstacle realised as TERRAIN: the binding paints the door cell `water`
 * (`procgenSeedlingElements.WATER_DOOR_IDS`) — no entity, no tag. It certifies
 * on the two solver facts landed beside it: the solver's plan bag carries the
 * boot's inventory (D1) and the staging pins `'sound'` because the RECORD holds
 * water (D2).
 *
 * ⛓ THE WITNESS, measured at swim S1's D3 (`generate-seedling-level.mjs
 * --biome=post-swim --elements=watergate --skeleton=empty --width=10
 * --height=10`): seeds 1..8 all place and certify; seed 4 is the shortest
 * (73 ticks), and `--require=canSwim` grades STRONG on seeds 1..4.
 *
 * MUTANTS (predicted, then measured — the report's D3 table):
 *  (b) `pinsForRecord`'s water clause dropped ⇒ the certification solve THROWS
 *      `PhysicsV2Error` (W0 arm C), so the "certifies" row reds.
 *  (c) `POST_SWIM_ITEMS.canSwim` false ⇒ the seam refuses BY NAME
 *      (`the-element-needs-an-item-this-biome-does-not-grant`).
 *  (d) `ITEM_LABELS.canSwim` dropped ⇒ the requirement row names `canSwim`,
 *      not `Progressive Swim`.
 */

import { describe, expect, it } from 'vitest';

import { generateSeedlingLevel } from './procgenSeedling.js';
import { seedlingOnConnectorEntities, WATER_DOOR_IDS } from './procgenSeedlingElements.js';
import {
    POST_SHIELD_PALETTE, POST_SWIM_ITEMS, POST_SWIM_PALETTE, POST_SWORD_PALETTE,
} from './procgenPalette.js';
import { ITEM_LABELS, gradeOf, requirementsFor } from './procgenRequirements.js';
import { DEFAULT_BUDGET } from './procgenOracle.js';
import { terrainAt } from './procgenLevel.js';
import { GEN_ROOM_BIOMES } from './seedlingGenRoom.js';
import { GEN_ROOM_BIOME_NAMES } from './seedlingGenRoomPayload.js';
import { BIOME_NAMES, DEFAULT_CENSUS_BIOMES, paletteFor } from './watchGenerate.js';
import { ELEMENT_TABLE, parseElementSpec } from '../procgenCore/elementSpec.js';
import {
    ROCK_GATE_REFUSALS, WATER_GATE, WATER_GATE_DOOR_ID, WATER_GATE_REFUSALS,
} from '../procgenCore/elements/soloDoor.js';
import { LAW_CUT } from '../procgenCore/elements.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';

const WITNESS = Object.freeze({ seed: 4, kind: 'empty', width: 10, height: 10 });

const gen = (palette, { seed = WITNESS.seed } = {}) => generateSeedlingLevel({
    seed, palette,
    defaults: { width: WITNESS.width, height: WITNESS.height },
    skeleton: parseSkeleton(WITNESS.kind, { substrate: 'seedling' }),
    elements: parseElementSpec('watergate'),
});

describe('⛓⛓⛓ the WATER GATE element and its table row (swim S1, D3)', () => {
    it('is the rock gate\'s geometry: law `cut`, the rock gate\'s refusals, one door id', () => {
        expect(WATER_GATE.family).toBe('watergate');
        expect(WATER_GATE.phase).toBe('on-connector');
        expect(WATER_GATE.law).toBe(LAW_CUT);
        expect(WATER_GATE_REFUSALS).toEqual(ROCK_GATE_REFUSALS);
        expect(ELEMENT_TABLE.watergate.element).toBe(WATER_GATE);
        expect(ELEMENT_TABLE.watergate.needs).toEqual(['canSwim']);
        expect(ITEM_LABELS.canSwim).toBe('Progressive Swim');
    });

    it('the realiser makes NO entity and spends NO tag for a water door', () => {
        let tags = 0;
        const out = seedlingOnConnectorEntities({
            placed: { entities: [{ role: 'obstacle', x: 3, y: 2, id: WATER_GATE_DOOR_ID }] },
            tagFor: () => { tags += 1; return 7; },
        });
        expect(WATER_DOOR_IDS).toContain(WATER_GATE_DOOR_ID);
        expect(out.entities).toEqual([]);
        expect(out.tags).toEqual({});
        expect(tags).toBe(0);
    });

    it('`post-swim` is a biome on every list that offers one, and in NO census default', () => {
        expect(POST_SWIM_ITEMS).toEqual({ hasSword: true, hasShield: true, canSwim: true });
        expect(POST_SWIM_PALETTE.templates).toBe(POST_SWORD_PALETTE.templates);
        expect(POST_SWIM_PALETTE.excluded).toBe(POST_SWORD_PALETTE.excluded);
        expect(paletteFor('post-swim')).toBe(POST_SWIM_PALETTE);
        expect(BIOME_NAMES).toContain('post-swim');
        expect(GEN_ROOM_BIOME_NAMES).toContain('post-swim');
        expect(GEN_ROOM_BIOMES['post-swim']).toBe(POST_SWIM_PALETTE);
        expect(DEFAULT_CENSUS_BIOMES).not.toContain('post-swim');
    });
});

describe('⛓⛓⛓ the WATER GATE on a generated Seedling level (swim S1, D3)', () => {
    it('post-swim: places, CERTIFIES, and the door cell is water with no entity on it', () => {
        const out = gen(POST_SWIM_PALETTE);
        expect(out.model.elements.ran).toBe(true);
        const placed = out.model.elements.placed[0];
        expect(placed.family).toBe('watergate');
        expect(placed.tags).toEqual({});
        expect(out.certification.certified).toBe(true);
        const { x, y } = placed.doorCell;
        expect(terrainAt(out.record, x, y)).toBe('water');
        expect(placed.painted).toContainEqual({ tx: x, ty: y, terrain: 'water' });
        /** ⛓ The door cell holds NO entity — the gate is the tile. */
        const atDoor = out.record.entities.filter((e) => Math.floor(e.x / 16) === x
            && Math.floor(e.y / 16) === y);
        expect(atDoor).toEqual([]);
        /** ⛓ D2 — the record holds water, so the summary pins `sound`. */
        expect(out.summary.pins).toContain('sound');
    }, 120000);

    it('post-swim: `canSwim` is REQUIRED — STRONG, and the row names the AP item', () => {
        const out = gen(POST_SWIM_PALETTE);
        const rep = requirementsFor({
            record: out.record, model: out.model, palette: POST_SWIM_PALETTE,
            summary: out.summary, seed: WITNESS.seed, biome: 'post-swim',
        }, { verdict: 'SOLVED', ticks: out.summary.finalTicks }, { budget: DEFAULT_BUDGET });
        const row = rep.rows.find((r) => r.flag === 'canSwim');
        expect(row.item).toBe('Progressive Swim');
        expect(row.verdict).toBe('REQUIRED');
        expect(gradeOf(row)).toBe('STRONG');
    }, 120000);

    it('`require:[canSwim]` through the pipeline is MET via the water gate, STRONG', () => {
        const out = generateSeedlingLevel({ seed: WITNESS.seed, palette: POST_SWIM_PALETTE,
            defaults: { width: WITNESS.width, height: WITNESS.height },
            skeleton: parseSkeleton(WITNESS.kind, { substrate: 'seedling' }),
            elements: parseElementSpec('watergate'), require: ['canSwim'] });
        expect(out.require.element).toBe('watergate');
        expect(out.require.met).toBe(true);
        expect(out.require.grade).toBe('STRONG');
    }, 120000);

    it('post-shield: REFUSED BY NAME with no solve — the boot grants no conch', () => {
        const out = gen(POST_SHIELD_PALETTE);
        expect(out.certification.gap).toBe('the-element-needs-an-item-this-biome-does-not-grant');
        expect(out.certification.needs).toEqual(['canSwim']);
        expect(out.certification.verdict).toBe(null);
        expect(out.model.elements.ran).toBe(false);
    }, 120000);
});
