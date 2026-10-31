/**
 * seedlingDemo — **THE CHEST DOOR on Seedling: a chest in the only gap of a
 * wall, opened from the south, and its seal piece an AP location** (seedling
 * gen content B2, the L38 pattern; ⚖ the user 2026-10-30).
 *
 * The element's geometry is `procgenCore/elements/chestDoor.js` (its own rows
 * drive the placement rules and their mutants). This file drives the BINDING,
 * the SEAM and the LOCATION:
 *  · the entity row — `chest {tag}`, ONE tag from the 30;
 *  · a generated room places and CERTIFIES with `chest` before the collect,
 *    pre-sword AND post-sword (`needs: []`, measured);
 *  · the seam REFUSES a solve that reaches the goal without opening the chest
 *    (a second gap), naming `chest-door-bypassed`;
 *  · the location: `summary.chestDoors` carries the chest's cell and tag, the
 *    tag is the engine's own `tagOf` (the check address), and the name is
 *    `<room> - Chest`, vanilla's shape.
 *
 * ⛓ THE WITNESS, measured at this slice (`empty` 10x10, seeds 1..3): every
 * seed places and certifies `[chest, collect]` in both biomes.
 *
 * MUTANTS (predicted, then measured — the slice's as-built):
 *  (a) `chestDoorBypassRefusal` returns null always ⇒ the second-gap row reds
 *      (the gapped room SOLVES with `[collect]`);
 *  (b) the chest's tag not allocated (`tag: '-1'`) ⇒ the binding, tag-budget and
 *      location rows red;
 *  (c) `doorSolidForCarve` dropped ⇒ the pocket row reds (the carve law counts
 *      the chest as the pocket's second mouth and the winding witness refuses).
 */

import { describe, expect, it } from 'vitest';

import {
    CHEST_DOOR_LOCATION_SUFFIX, chestDoorBypassRefusal, chestDoorLocationName, generateSeedlingLevel,
    seedlingOracle,
} from './procgenSeedling.js';
import { seedlingOnConnectorEntities } from './procgenSeedlingElements.js';
import { POST_SWORD_PALETTE, PRE_SWORD_PALETTE } from './procgenPalette.js';
import { VERDICT } from './procgenOracle.js';
import { oelAtTile, withTerrain } from './procgenLevel.js';
import { tagOf } from './levelWorld.js';
import { placementKey } from './apPlacementRewriter.js';
import { ELEMENT_NAMES, ELEMENT_TABLE, headsNeeding, parseElementSpec } from '../procgenCore/elementSpec.js';
import { CHEST_DOOR, CHEST_DOOR_CHEST_ID } from '../procgenCore/elements/chestDoor.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';

const gen = (palette, { seed = 1, kind = 'empty', size = 10 } = {}) => generateSeedlingLevel({
    seed, palette,
    defaults: { width: size, height: size },
    skeleton: parseSkeleton(kind, { substrate: 'seedling' }),
    elements: parseElementSpec('chestdoor'),
});

const CHEST = { role: 'obstacle', x: 3, y: 7, id: CHEST_DOOR_CHEST_ID };

describe('⛓⛓⛓ the CHEST DOOR\'s table row and binding row (seedling gen B2)', () => {
    it('the head is `chestdoor`, LAST, needs no item, opt-in and not a `require` head', () => {
        expect(ELEMENT_TABLE.chestdoor.element).toBe(CHEST_DOOR);
        expect(ELEMENT_TABLE.chestdoor.needs).toEqual([]);
        expect(ELEMENT_TABLE.chestdoor.meetsRequire).toBe(false);
        expect(ELEMENT_NAMES.at(-1)).toBe('chestdoor');
        for (const flag of ['hasSword', 'hasShield', 'hasSwim', 'hasFeather']) {
            expect(headsNeeding(flag)).not.toContain('chestdoor');
        }
    });

    it('chest → `chest {tag}`, the vanilla spelling, at its own cell', () => {
        const out = seedlingOnConnectorEntities({ placed: { entities: [CHEST] }, tagFor: () => 4 });
        expect(out.entities).toEqual([{ type: 'chest', tx: 3, ty: 7, attrs: { tag: '4' } }]);
    });

    it('the TAG BUDGET: exactly one tag from the 30 (the chest\'s — its persistence AND its check address)', () => {
        let tags = 0;
        const out = seedlingOnConnectorEntities({
            placed: { entities: [CHEST] },
            tagFor: () => { tags += 1; return 9; },
        });
        expect(tags).toBe(1);
        expect(out.tags).toEqual({ chest: 9 });
        expect(tagOf('chest', out.entities[0].attrs)).toBe(9);
    });
});

describe('⛓⛓⛓ the CHEST DOOR on a generated Seedling level', () => {
    for (const [biome, palette] of [['pre-sword', PRE_SWORD_PALETTE], ['post-sword', POST_SWORD_PALETTE]]) {
        it(`${biome}: places, CERTIFIES with \`chest\` before the collect — the chest it placed`, () => {
            const out = gen(palette);
            expect(out.model.elements.ran).toBe(true);
            const placed = out.model.elements.placed[0];
            expect(placed.family).toBe('chestdoor');
            expect(Object.keys(placed.tags)).toEqual(['chest']);
            expect(out.certification.certified).toBe(true);
            expect(out.certification.strategies).toEqual(['chest', 'collect']);
            /** the record: one chest, on the door cell, its stance the cell below */
            const chests = out.record.entities.filter((e) => e.type === 'chest');
            expect(chests).toHaveLength(1);
            expect(chests[0]).toMatchObject(oelAtTile(placed.doorCell.x, placed.doorCell.y));
            expect(placed.clearer).toEqual([{ x: placed.doorCell.x, y: placed.doorCell.y + 1 }]);
            /** distinct persistence tags, inside the 30 */
            const tags = out.record.entities.map((e) => Number(e.attrs?.tag)).filter((t) => t >= 0);
            expect(new Set(tags).size).toBe(tags.length);
            expect(Math.max(...tags)).toBeLessThan(30);
        }, 120000);
    }

    it('THE POCKET: a one-wide corridor (winding seed 1) carves the doubling-back and certifies', () => {
        const out = gen(POST_SWORD_PALETTE, { kind: 'winding' });
        const placed = out.model.elements.placed[0];
        expect(placed.carved.length).toBeGreaterThan(0);
        expect(placed.carved).toContainEqual(placed.clearer[0]);
        expect(out.certification.strategies).toEqual(['chest', 'collect']);
    }, 120000);

    it('certify N: `empty` 10x10 seeds 1..3, both biomes — every one `[chest, collect]`', () => {
        const rows = [];
        for (const palette of [PRE_SWORD_PALETTE, POST_SWORD_PALETTE]) {
            for (const seed of [1, 2, 3]) {
                const out = gen(palette, { seed });
                rows.push(out.certification.strategies.join(','));
            }
        }
        expect(rows).toEqual(Array(6).fill('chest,collect'));
    }, 300000);
});

describe('⛓⛓⛓ THE SEAM: a chest door is certified only by a plan that OPENS it', () => {
    it('a SECOND GAP the walk takes is REFUSED, `chest-door-bypassed`, naming the chest', () => {
        const out = gen(POST_SWORD_PALETTE);
        const placed = out.model.elements.placed[0];
        const oracle = seedlingOracle({ model: out.model, items: POST_SWORD_PALETTE.items });
        /** control: the room as generated solves through the chest */
        expect(oracle.solve(out.record).verdict).toBe(VERDICT.SOLVED);
        /** a gap knocked in the grown wall beside the chest (`empty` seed 1: (3,6)) */
        const gap = placed.wall.find((w) => w.x === placed.doorCell.x && w.y === placed.doorCell.y - 1);
        const gapped = withTerrain(out.record, [{ tx: gap.x, ty: gap.y, terrain: 'ground' }]);
        const r = oracle.solve(gapped);
        expect(r.verdict).toBe(VERDICT.REFUSED);
        expect(r.obstacle).toEqual({ kind: 'chest-door-bypassed', id: `chest@${oelAtTile(placed.doorCell.x,
            placed.doorCell.y).x},${oelAtTile(placed.doorCell.x, placed.doorCell.y).y}` });
        expect(r.reasonText).toMatch(/WITHOUT opening the chest door/);
    }, 120000);

    it('`chestDoorBypassRefusal` is inert without a chest door, and for a plan that opens it', () => {
        const model = { elements: { ran: true, placed: [{ family: 'chestdoor', doorCell: { x: 3, y: 7 } }] } };
        const id = `chest@${oelAtTile(3, 7).x},${oelAtTile(3, 7).y}`;
        const solved = (records) => ({ verdict: VERDICT.SOLVED, records });
        expect(chestDoorBypassRefusal(model, solved([{ strategy: 'chest', chest: { id } },
            { strategy: 'collect' }]))).toBe(null);
        expect(chestDoorBypassRefusal(model, solved([{ strategy: 'collect' }])).verdict).toBe(VERDICT.REFUSED);
        /** another chest opened is not this one */
        expect(chestDoorBypassRefusal(model, solved([{ strategy: 'chest', chest: { id: 'chest@0,0' } }]))
            .obstacle.kind).toBe('chest-door-bypassed');
        expect(chestDoorBypassRefusal({ elements: { ran: false, placed: [] } }, solved([]))).toBe(null);
        expect(chestDoorBypassRefusal({ elements: { ran: true, placed: [{ family: 'ropegate' }] } },
            solved([]))).toBe(null);
        expect(chestDoorBypassRefusal(model, { verdict: VERDICT.REFUSED })).toBe(null);
    });
});

describe('⛓⛓ THE AP LOCATION: each door chest\'s seal piece', () => {
    it('`summary.chestDoors` carries the chest\'s cell and tag — and the tag IS the check address', () => {
        const out = gen(POST_SWORD_PALETTE);
        const placed = out.model.elements.placed[0];
        expect(out.summary.chestDoors).toEqual([{ kind: 'chest-door',
            cell: { tx: placed.doorCell.x, ty: placed.doorCell.y }, tag: placed.tags.chest }]);
        const chest = out.record.entities.find((e) => e.type === 'chest');
        expect(tagOf(chest.type, chest.attrs)).toBe(out.summary.chestDoors[0].tag);
        /** the game reports `pendingCheck "<seq>|<level>|<tag>|0"`; the table keys `level|tag` */
        expect(placementKey(out.record.level, out.summary.chestDoors[0].tag))
            .toBe(`${out.record.level}|${placed.tags.chest}`);
    }, 120000);

    it('the NAME is vanilla\'s shape: `<room> - Chest` (vanilla: `Level NNN - Chest`)', () => {
        expect(CHEST_DOOR_LOCATION_SUFFIX).toBe('Chest');
        expect(chestDoorLocationName('Level 038')).toBe('Level 038 - Chest');
        expect(chestDoorLocationName('Region 4')).toBe('Region 4 - Chest');
    });

    it('⛔ a level without a chest door carries NO `chestDoors` key (no committed payload moves)', () => {
        const out = generateSeedlingLevel({
            seed: 1, palette: POST_SWORD_PALETTE, defaults: { width: 10, height: 10 },
            skeleton: parseSkeleton('empty', { substrate: 'seedling' }), elements: parseElementSpec('none'),
        });
        expect('chestDoors' in out.summary).toBe(false);
    }, 120000);
});
