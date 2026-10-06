/**
 * ⛓ RULES burnable-trees — a burnable tree GATES the crossings it blocks.
 *
 * Two defects let the playthrough rules walk past a tree for free (the fidelity arc's route survey found them
 * once its solver could burn):
 *   - `seedlingSemantics`' `burnabletree` row had no `size`, so it sealed ONE tile of the 2x2 hitbox it inherits
 *     from `Tree` (Scenery/Tree.as:23) and the flood walked round the other three — L12, L37, L40 and L44's trees
 *     split nothing;
 *   - a door INSIDE the tree (L24's two teleporters to L12) binds to the open component with a Fire cost the
 *     generator dropped as a "permissive binding". The analyzer's `tileSolid` oracle now marks such a door
 *     `sealedIn`, and the generator charges its own cell.
 *
 * Each row BUILDS the atlas fresh, so a regression reds here and not only in a `--check`.
 */
import { describe, it, expect, beforeAll } from 'vitest';

import { buildPlaythroughAtlas, sealedDoorsCharged } from './make-seedling-playthrough-rules.mjs';
import { ENTITY_SEMANTICS, entityPixelRect } from '../../frontend/modules/flashPanel/seedlingSemantics.js';
import { ENTITY_CLASSES } from '../../frontend/modules/seedlingDemo/levelWorld.js';

let atlas;
beforeAll(() => { atlas = buildPlaythroughAtlas(); }, 120_000);

const regionOf = (id) => atlas.regions.find((r) => r.region_id === id);
const exitOf = (id, exitId) => regionOf(id).exits.find((e) => e.exit_id === exitId);
const rowOf = (id, from, to) => regionOf(id).subgraph.internal_exits
    .find((e) => (e.from === from && e.to === to) || (e.bidirectional && e.from === to && e.to === from));
const FIRE = { rule: 'Has', args: { item_name: 'Fire' } };
const mentionsFire = (rule) => JSON.stringify(rule ?? null).includes('"Fire"');

describe('the transcription claims the footprint the game collides with', () => {
    // A gated row's `size` decides which tiles it SEALS; the model's collider is the game's own hitbox. A gated
    // row smaller than its collider lets the flood walk round an item gate for free — the burnabletree defect.
    it('every item-gated entity row has the model\'s rect collider as its footprint', () => {
        const mismatched = [];
        for (const [tag, row] of Object.entries(ENTITY_SEMANTICS)) {
            if (row.kind !== 'gated') continue;
            const model = ENTITY_CLASSES[tag];
            // RopeStart's width is per placement (`spanAttr`); the model carries it the same way.
            if (row.spanAttr) continue;
            expect(model?.collider, `${tag} has a rect collider in the model`).toBe('rect');
            // ⛓ RULES footprints: the row's rect is the model's hitbox now (`seedlingFootprints.test.js` holds every
            // row, not only the gated ones); this row keeps the gated half as the tree slice wrote it.
            const ours = entityPixelRect({ x: 0, y: 0, attrs: {} }, row);
            const left = (model.dx ?? 0) - (model.originX ?? 0);
            const top = (model.dy ?? 0) - (model.originY ?? 0);
            if (model.w !== ours.w || model.h !== ours.h || left !== ours.x || top !== ours.y) {
                mismatched.push(`${tag}: ${JSON.stringify(ours)} vs the model's ${model.w}x${model.h} px at +${left},+${top}`);
            }
        }
        expect(mismatched).toEqual([]);
    });
});

describe('a burnable tree between two exits SPLITS the region and gates the crossing on Fire', () => {
    it('L44: the L37 door and the L87 arrival are in different sub-regions, and the way between costs Fire (or Swim)', () => {
        expect(exitOf('level_44', 'out_teleporter_144_128').sub_region).toBe('r6c4');
        expect(exitOf('level_44', 'in_L87_464_272').sub_region).toBe('r4c2');
        expect(mentionsFire(rowOf('level_44', 'r4c2', 'r6c4').access_rule)).toBe(true);
    });

    it('L37: the L38 arrival is cut off from the L12 and L44 doors by the tree', () => {
        expect(exitOf('level_37', 'in_L38_144_304').sub_region).toBe('r0c18');
        expect(exitOf('level_37', 'out_teleporter_32_304').sub_region).toBe('r12c6');
        expect(exitOf('level_37', 'out_teleporter_0_256').sub_region).toBe('r12c6');
        expect(mentionsFire(rowOf('level_37', 'r0c18', 'r12c6').access_rule)).toBe(true);
    });

    it('L12: the tree at (480,640) walls r42c29 off from r0c37 except by Fire', () => {
        expect(rowOf('level_12', 'r0c37', 'r42c29').access_rule).toEqual(FIRE);
    });
});

describe('a door INSIDE an item-gated solid is charged that solid', () => {
    it('L24: both teleporters to L12 sit inside burnabletree@32,128 and cost Fire', () => {
        expect(exitOf('level_24', 'out_teleporter_32_144').access_rule).toEqual(FIRE);
        expect(exitOf('level_24', 'out_teleporter_48_144').access_rule).toEqual(FIRE);
    });

    it('L32: the arena-exit pits under its tree cost Fire', () => {
        expect(exitOf('level_32', 'out_pit_14_5').access_rule).toEqual(FIRE);
        expect(exitOf('level_32', 'out_pit_15_5').access_rule).toEqual(FIRE);
    });

    it('only the transcription\'s OWN item-gated solids count — never an overlay puzzle ruling (L5\'s lock)', () => {
        expect(sealedDoorsCharged.filter((d) => d.startsWith('level_5/'))).toEqual([]);
        expect(exitOf('level_5', 'out_teleporter_48_112').access_rule).toBeUndefined();
    });
});
